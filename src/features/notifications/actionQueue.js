import { NOTIFICATION_ACTION_IDS, SNOOZE_DELAY_MS } from '../../../supabase/functions/_shared/notification-actions.js'

export const NOTIFICATION_ACTION_DB = 'traker-notification-actions'
const STORE = 'actions'
const VALID_ACTIONS = new Set(NOTIFICATION_ACTION_IDS)

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openQueue(databaseName = NOTIFICATION_ACTION_DB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('by-available-at', 'availableAt')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `notification-action-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Device-local transport queue between the Service Worker and the hydrated app.
 * It is intentionally not Sync v2 data: actions are short-lived commands for
 * this device, never user content, and are deleted immediately after handling.
 */
export async function enqueueNotificationAction({ action, habitId, url = '', id = createId() }, {
  now = Date.now(),
  databaseName = NOTIFICATION_ACTION_DB,
} = {}) {
  if (!VALID_ACTIONS.has(action)) throw new TypeError(`Unsupported notification action: ${action}`)
  if (!habitId) throw new TypeError('habitId is required for a direct notification action')
  const createdAt = Number(now)
  const record = {
    id,
    action,
    habitId: String(habitId),
    url: String(url || ''),
    createdAt,
    availableAt: createdAt + (action === 'snooze' ? SNOOZE_DELAY_MS : 0),
    state: 'pending',
    leaseUntil: null,
  }
  const db = await openQueue(databaseName)
  try {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(record)
    await transactionDone(transaction)
    return record
  } finally {
    db.close()
  }
}

export async function claimDueNotificationActions({
  now = Date.now(),
  leaseMs = 30_000,
  limit = 10,
  databaseName = NOTIFICATION_ACTION_DB,
} = {}) {
  const db = await openQueue(databaseName)
  try {
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const records = await requestResult(store.getAll())
    const due = records
      .filter(record => record.availableAt <= now
        && (record.state === 'pending' || Number(record.leaseUntil ?? 0) <= now))
      .sort((a, b) => a.availableAt - b.availableAt || a.createdAt - b.createdAt)
      .slice(0, Math.max(1, Number(limit) || 1))
      .map(record => ({ ...record, state: 'processing', leaseUntil: now + leaseMs }))
    due.forEach(record => store.put(record))
    await transactionDone(transaction)
    return due
  } finally {
    db.close()
  }
}

export async function completeNotificationAction(id, { databaseName = NOTIFICATION_ACTION_DB } = {}) {
  const db = await openQueue(databaseName)
  try {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(id)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function releaseNotificationAction(id, { databaseName = NOTIFICATION_ACTION_DB } = {}) {
  const db = await openQueue(databaseName)
  try {
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const record = await requestResult(store.get(id))
    if (record) store.put({ ...record, state: 'pending', leaseUntil: null })
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function nextNotificationActionAt({ databaseName = NOTIFICATION_ACTION_DB } = {}) {
  const db = await openQueue(databaseName)
  try {
    const transaction = db.transaction(STORE, 'readonly')
    const records = await requestResult(transaction.objectStore(STORE).getAll())
    await transactionDone(transaction)
    if (!records.length) return null
    return Math.min(...records.map(record => record.state === 'processing'
      ? Number(record.leaseUntil ?? record.availableAt)
      : Number(record.availableAt)))
  } finally {
    db.close()
  }
}

export function deleteNotificationActionDatabase(databaseName = NOTIFICATION_ACTION_DB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Notification action database is blocked: ${databaseName}`))
  })
}


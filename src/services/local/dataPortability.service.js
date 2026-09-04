import { storage } from '@/services/storage.js'
import {
  deleteGoalsDatabase,
  GOALS_DB_NAME,
  GOALS_STORES,
  openGoalsDatabase,
} from './goals.database.js'
import {
  deleteV2Database,
  openV2Database,
  V2_DB_NAME,
  V2_STORES,
} from './v2.database.js'
import { exportV2Data } from './v2.export.js'
import {
  deleteNotificationActionDatabase,
  NOTIFICATION_ACTION_DB,
} from '@/features/notifications/actionQueue.js'

export const LOCAL_BACKUP_SCHEMA = 2

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} no tiene un formato válido.`)
  }
  return value
}

function requireStoreArrays(value, storeNames, label) {
  const source = requireRecord(value, label)
  return Object.fromEntries(storeNames.map(storeName => {
    if (!Array.isArray(source[storeName])) {
      throw new Error(`${label}.${storeName} debe ser una lista.`)
    }
    return [storeName, source[storeName]]
  }))
}

/**
 * Validates the complete portable envelope before any existing data is
 * deleted. Unknown top-level fields are ignored for forward-compatible
 * metadata, while every store owned by this app must be present as an array.
 */
export function validateLocalDeviceBackup(bundle) {
  const candidate = requireRecord(bundle, 'El respaldo')
  if (candidate._schema !== LOCAL_BACKUP_SCHEMA) {
    const direction = Number(candidate._schema) > LOCAL_BACKUP_SCHEMA
      ? 'una versión más reciente de Traker'
      : 'un formato anterior no compatible'
    throw new Error(`El respaldo usa ${direction}.`)
  }
  if (candidate._database !== V2_DB_NAME) {
    throw new Error('El archivo no corresponde a un respaldo local de Traker.')
  }
  const legacy = requireRecord(candidate.legacy, 'legacy')
  if (Number(legacy._schema ?? 0) > storage.SCHEMA_VERSION) {
    throw new Error('Los datos locales requieren una versión más reciente de Traker.')
  }
  const stores = requireStoreArrays(candidate.stores, Object.values(V2_STORES), 'stores')
  const legacyGoals = requireStoreArrays(candidate.legacyGoals, Object.values(GOALS_STORES), 'legacyGoals')
  return { ...candidate, legacy, stores, legacyGoals }
}

async function replaceIndexedStores({ openDatabase, deleteDatabase, databaseName, storeNames, snapshot }) {
  await deleteDatabase(databaseName)
  const db = await openDatabase({ name: databaseName })
  const transaction = db.transaction(storeNames, 'readwrite')
  for (const storeName of storeNames) {
    const store = transaction.objectStore(storeName)
    for (const record of snapshot[storeName]) {
      // Backups are JSON by contract. This also unwraps Vue proxies when the
      // validated payload has temporarily lived inside a component ref.
      await store.put(JSON.parse(JSON.stringify(record)))
    }
  }
  await transaction.done
}

async function writeBackupDatabases(bundle, { goalsDatabaseName, v2DatabaseName }) {
  await replaceIndexedStores({
    openDatabase: openGoalsDatabase,
    deleteDatabase: deleteGoalsDatabase,
    databaseName: goalsDatabaseName,
    storeNames: Object.values(GOALS_STORES),
    snapshot: bundle.legacyGoals,
  })
  await replaceIndexedStores({
    openDatabase: openV2Database,
    deleteDatabase: deleteV2Database,
    databaseName: v2DatabaseName,
    storeNames: Object.values(V2_STORES),
    snapshot: bundle.stores,
  })
}

/**
 * Builds one portable snapshot of every local data store. Sensitive access
 * material is filtered by storage.exportData before it reaches this payload.
 */
export function exportLocalDeviceData(options = {}) {
  return exportV2Data(options)
}

/**
 * Replaces the local device copy with a validated Traker backup. Supabase
 * sessions and API access material are neither read from the file nor
 * overwritten. The preflight databases exercise key paths and unique indexes
 * before current data is touched.
 */
export async function importLocalDeviceData(bundle, {
  goalsDatabaseName = GOALS_DB_NAME,
  v2DatabaseName = V2_DB_NAME,
} = {}) {
  const validated = validateLocalDeviceBackup(bundle)
  const suffix = crypto.randomUUID()
  const preflight = {
    goalsDatabaseName: `${goalsDatabaseName}-restore-check-${suffix}`,
    v2DatabaseName: `${v2DatabaseName}-restore-check-${suffix}`,
  }

  try {
    await writeBackupDatabases(validated, preflight)
  } finally {
    await Promise.allSettled([
      deleteGoalsDatabase(preflight.goalsDatabaseName),
      deleteV2Database(preflight.v2DatabaseName),
    ])
  }

  await writeBackupDatabases(validated, { goalsDatabaseName, v2DatabaseName })
  storage.clearAll({ preserveSessions: true })
  storage.importData(validated.legacy)

  return {
    restoredDatabases: [goalsDatabaseName, v2DatabaseName],
    remotePreserved: true,
    sessionsPreserved: true,
  }
}

/**
 * Deletes local application data without touching Supabase rows or turning a
 * data reset into an unexpected account sign-out.
 */
export async function deleteLocalDeviceData({
  goalsDatabaseName = GOALS_DB_NAME,
  v2DatabaseName = V2_DB_NAME,
} = {}) {
  await Promise.all([
    deleteGoalsDatabase(goalsDatabaseName),
    deleteV2Database(v2DatabaseName),
    deleteNotificationActionDatabase(),
  ])
  storage.clearAll({ preserveSessions: true })
  return {
    deletedDatabases: [goalsDatabaseName, v2DatabaseName, NOTIFICATION_ACTION_DB],
    remotePreserved: true,
    sessionsPreserved: true,
  }
}

function removeNamespacedSessionData() {
  if (typeof sessionStorage === 'undefined') return
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith('traker:')) sessionStorage.removeItem(key)
  }
}

function removeNamespacedLocalData() {
  if (typeof localStorage === 'undefined') return
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('traker:')) localStorage.removeItem(key)
  }
}

async function removeTrakerCaches() {
  if (!globalThis.caches?.keys) return []
  const names = await globalThis.caches.keys()
  const matching = names.filter(name => name.toLowerCase().includes('traker'))
  await Promise.all(matching.map(name => globalThis.caches.delete(name)))
  return matching
}

/**
 * Clears the complete device footprint after the server confirms permanent
 * account deletion. Unlike the local-only reset, sessions and legacy keys are
 * intentionally removed as well.
 */
export async function deleteAccountDeviceData({
  goalsDatabaseName = GOALS_DB_NAME,
  v2DatabaseName = V2_DB_NAME,
} = {}) {
  await Promise.all([
    deleteGoalsDatabase(goalsDatabaseName),
    deleteV2Database(v2DatabaseName),
    deleteNotificationActionDatabase(),
  ])
  storage.clearAll({ preserveSessions: false })
  removeNamespacedLocalData()
  removeNamespacedSessionData()
  const deletedCaches = await removeTrakerCaches()
  return {
    deletedDatabases: [goalsDatabaseName, v2DatabaseName, NOTIFICATION_ACTION_DB],
    deletedCaches,
    remoteDeleted: true,
    sessionsPreserved: false,
  }
}

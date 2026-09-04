import { currentTimezone, normalizeHabitLogOutcome } from '@/features/habits/domain.js'
import { openV2Database, V2_DB_NAME, V2_STORES } from './local/v2.database.js'
import { createSyncOperation, syncV2 } from './supabase/syncV2.service.js'
export { ensureV2LocalOwner } from './local/v2.ownership.js'

export const SYNC_V2_DEVICE_KEY = 'sync-v2-device'
export const PILOT_V2_ENTITY_TYPES = Object.freeze(['habit', 'habitLog', 'rewardClaim'])

const SUPPORTED_MUTATIONS = new Set([
  'upsert-habit',
  'delete-habit',
  'restore-habit',
  'upsert-entry',
  'delete-entry',
  'upsert-reward-claim',
])
const SUPPORTED_ENTITIES = new Set(PILOT_V2_ENTITY_TYPES)
const TERMINAL_STATES = new Set(['conflict', 'rejected', 'blocked'])
const pushChains = new Map()
let stageSequence = 0

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const value = Math.floor(Math.random() * 16)
      return (token === 'x' ? value : ((value & 0x3) | 0x8)).toString(16)
    })
}

function errorCode(error) {
  return error?.code ?? error?.message ?? 'sync_unavailable'
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

export function supportsPilotV2Mutation(type) {
  return SUPPORTED_MUTATIONS.has(type)
}

export function toPilotV2Operation(type, payload, {
  operationId = randomId(),
  occurredAt = new Date().toISOString(),
} = {}) {
  if (!supportsPilotV2Mutation(type)) return null

  if (type === 'upsert-habit') {
    const habit = payload?.habit
    if (!habit?.id) return null
    return createSyncOperation({
      operationId,
      entityType: 'habit',
      entityId: habit.id,
      baseVersion: Math.max(0, Number(habit.version) - 1 || 0),
      payload: {
        name: habit.name,
        minimumVersion: habit.minimumVersion ?? '',
        icon: habit.icon ?? null,
        color: habit.color ?? null,
        duration: habit.duration,
        reminder: habit.reminder ?? null,
        reminderDays: habit.reminderDays ?? null,
        isActive: habit.isActive ?? true,
        lifecycleStatus: habit.lifecycleStatus ?? (habit.isActive === false ? 'paused' : 'active'),
        timezone: habit.schedule?.timezone ?? currentTimezone(),
        createdAt: habit.createdAt,
      },
      occurredAt: habit.updatedAt ?? occurredAt,
    })
  }

  if (type === 'delete-habit') {
    const habitId = payload?.habitId ?? payload?.habit?.id
    if (!habitId) return null
    return createSyncOperation({
      operationId,
      entityType: 'habit',
      entityId: habitId,
      operationType: 'delete',
      baseVersion: payload?.baseVersion ?? payload?.habit?.version ?? 0,
      occurredAt,
    })
  }

  if (type === 'restore-habit') {
    const habit = payload?.habit
    if (!habit?.id) return null
    return createSyncOperation({
      operationId,
      entityType: 'habit',
      entityId: habit.id,
      operationType: 'restore',
      baseVersion: payload?.baseVersion ?? Math.max(0, Number(habit.version) - 1 || 0),
      payload: {},
      occurredAt: habit.updatedAt ?? occurredAt,
    })
  }

  if (type === 'upsert-entry') {
    const log = payload?.log
    if (!payload?.habitId || !log?.id) return null
    const outcome = normalizeHabitLogOutcome(log)
    return createSyncOperation({
      operationId,
      entityType: 'habitLog',
      entityId: log.id,
      baseVersion: Math.max(0, Number(log.version) - 1 || 0),
      payload: {
        habitId: payload.habitId,
        localDate: log.localDate,
        timezone: log.timezone ?? currentTimezone(),
        occurrenceKey: log.occurrenceKey ?? `date:${log.localDate}`,
        status: outcome.status,
        minimumUsed: outcome.minimumUsed,
        contextCodes: outcome.contextCodes,
        note: log.note ?? '',
        occurredAt: log.loggedAt ?? occurredAt,
        clientOperationId: log.clientOperationId ?? operationId,
      },
      occurredAt: log.loggedAt ?? occurredAt,
    })
  }

  if (type === 'delete-entry') {
    const log = payload?.log
    if (!log?.id) return null
    return createSyncOperation({
      operationId,
      entityType: 'habitLog',
      entityId: log.id,
      operationType: 'delete',
      baseVersion: log.version ?? 0,
      payload: { habitId: payload.habitId },
      occurredAt,
    })
  }

  const claim = payload?.claim
  if (!claim?.id) return null
  return createSyncOperation({
    operationId,
    entityType: 'rewardClaim',
    entityId: claim.id,
    baseVersion: 0,
    payload: {
      ruleId: claim.ruleId,
      periodKey: claim.periodKey,
      unlockedAt: claim.unlockedAt,
      claimedAt: claim.claimedAt ?? null,
      usedAt: claim.usedAt ?? claim.redeemedAt ?? null,
    },
    occurredAt: claim.usedAt ?? claim.unlockedAt ?? occurredAt,
  })
}

async function applyLocalMutation(tx, type, payload, operation, now) {
  if (type === 'upsert-habit') {
    await tx.objectStore(V2_STORES.habits).put({
      ...clone(payload.habit),
      migrationQuality: 'native',
      deletedAt: null,
    })
    return
  }

  if (type === 'delete-habit') {
    const store = tx.objectStore(V2_STORES.habits)
    const existing = await store.get(operation.entityId)
    await store.put({
      ...(existing ?? clone(payload.habit) ?? {}),
      id: operation.entityId,
      isActive: false,
      lifecycleStatus: 'archived',
      deletedAt: now,
      version: Math.max(Number(existing?.version) || 0, operation.baseVersion + 1),
    })
    return
  }

  if (type === 'restore-habit') {
    // Keep the tombstone intact until the server accepts the restore. This
    // prevents an optimistic local resurrection when the base version is stale.
    return
  }

  if (type === 'upsert-entry') {
    await tx.objectStore(V2_STORES.habitLogs).put({
      ...clone(payload.log),
      habitId: payload.habitId,
      status: operation.payload.status,
      minimumUsed: operation.payload.minimumUsed,
      migrationQuality: 'native',
      deletedAt: null,
    })
    return
  }

  if (type === 'delete-entry') {
    const store = tx.objectStore(V2_STORES.habitLogs)
    const existing = await store.get(operation.entityId)
    await store.put({
      ...(existing ?? clone(payload.log) ?? {}),
      id: operation.entityId,
      habitId: payload.habitId,
      deletedAt: now,
      version: Math.max(Number(existing?.version) || 0, operation.baseVersion + 1),
    })
    return
  }

  await tx.objectStore(V2_STORES.rewardClaims).put({
    ...clone(payload.claim),
    migrationQuality: 'native',
  })
}

export async function getPilotV2DeviceId({
  databaseName = V2_DB_NAME,
  now = new Date().toISOString(),
  createId = randomId,
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const existing = await db.get(V2_STORES.migrationMeta, SYNC_V2_DEVICE_KEY)
  if (existing?.deviceId) return existing.deviceId
  const deviceId = `browser-${createId()}`
  await db.put(V2_STORES.migrationMeta, {
    key: SYNC_V2_DEVICE_KEY,
    deviceId,
    createdAt: now,
  })
  return deviceId
}

export async function stagePilotV2Mutation(type, payload, {
  databaseName = V2_DB_NAME,
  operationId,
  now = new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  if (operationId) {
    const existing = await db.get(V2_STORES.outbox, operationId)
    if (existing) return existing
  }

  if (type === 'restore-habit' && payload?.habit?.id) {
    const existingRestore = (await db.getAll(V2_STORES.outbox))
      .filter(record => record.entityType === 'habit'
        && record.entityId === payload.habit.id
        && record.operationType === 'restore'
        && record.state === 'pending')
      .sort(compareEntityOperations)
      .at(-1)
    if (existingRestore) return existingRestore
  }

  const operation = toPilotV2Operation(type, payload, { operationId, occurredAt: now })
  if (!operation) return null
  const deviceId = await getPilotV2DeviceId({ databaseName, now })
  const stores = [V2_STORES.outbox]
  if (operation.entityType === 'habit') stores.push(V2_STORES.habits)
  if (operation.entityType === 'habitLog') stores.push(V2_STORES.habitLogs)
  if (operation.entityType === 'rewardClaim') stores.push(V2_STORES.rewardClaims)
  const tx = db.transaction(stores, 'readwrite')
  await applyLocalMutation(tx, type, payload, operation, now)
  const record = {
    ...operation,
    deviceId,
    state: 'pending',
    attempts: 0,
    localSequence: ++stageSequence,
    createdAt: now,
    updatedAt: now,
  }
  await tx.objectStore(V2_STORES.outbox).put(record)
  await tx.done
  return record
}

async function updateAttempt(db, record, result, now) {
  const state = result?.result === 'applied' || result?.result === 'duplicate'
    ? 'synced'
    : result?.result === 'conflict'
      ? 'conflict'
      : 'rejected'
  const next = {
    ...record,
    state,
    attempts: (record.attempts ?? 0) + 1,
    updatedAt: now,
    lastAttemptAt: now,
    serverVersion: result?.newVersion ?? null,
    conflict: result?.conflict ?? null,
  }
  if (state === 'synced') next.syncedAt = now
  const stores = record.entityType === 'habit' && record.operationType === 'restore'
    ? [V2_STORES.outbox, V2_STORES.habits]
    : [V2_STORES.outbox]
  const tx = db.transaction(stores, 'readwrite')
  await tx.objectStore(V2_STORES.outbox).put(next)
  if (state === 'synced' && record.entityType === 'habit' && record.operationType === 'restore') {
    const habitStore = tx.objectStore(V2_STORES.habits)
    const tombstone = await habitStore.get(record.entityId)
    if (tombstone) {
      await habitStore.put({
        ...tombstone,
        isActive: true,
        lifecycleStatus: 'active',
        deletedAt: null,
        updatedAt: now,
        version: result?.newVersion ?? tombstone.version,
      })
    }
  }
  await tx.done
  return next
}

async function markBatchError(db, records, error, now) {
  for (const record of records) {
    await db.put(V2_STORES.outbox, {
      ...record,
      state: 'pending',
      attempts: (record.attempts ?? 0) + 1,
      updatedAt: now,
      lastAttemptAt: now,
      lastErrorCode: errorCode(error),
    })
  }
}

function compareEntityOperations(a, b) {
  return Number(a.baseVersion) - Number(b.baseVersion)
    || String(a.createdAt).localeCompare(String(b.createdAt))
    || Number(a.localSequence ?? 0) - Number(b.localSequence ?? 0)
    || a.operationId.localeCompare(b.operationId)
}

function groupPendingOperations(records) {
  const groups = new Map()
  for (const record of records) {
    const key = `${record.entityType}:${record.entityId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }
  for (const group of groups.values()) group.sort(compareEntityOperations)
  return groups
}

async function blockDependentOperations(db, records, failed, now) {
  for (const record of records) {
    await db.put(V2_STORES.outbox, {
      ...record,
      state: 'blocked',
      updatedAt: now,
      conflict: {
        code: 'blocked_by_prior_operation',
        operationId: failed.operationId,
      },
    })
  }
}

export async function flushPilotV2Outbox({
  databaseName = V2_DB_NAME,
  sync = syncV2,
  now = () => new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const pending = (await db.getAll(V2_STORES.outbox))
    .filter(record => record.state === 'pending' && SUPPORTED_ENTITIES.has(record.entityType))
  if (!pending.length) return { attempted: 0, synced: 0, conflicts: 0, rejected: 0 }

  const deviceId = await getPilotV2DeviceId({ databaseName })
  const totals = { attempted: 0, synced: 0, conflicts: 0, rejected: 0 }
  const groups = groupPendingOperations(pending)
  while (groups.size) {
    const selectedKeys = [...groups.keys()].sort().slice(0, 100)
    const batch = selectedKeys.map(key => groups.get(key)[0])
    const response = await sync.push(deviceId, batch.map(record => ({
      operationId: record.operationId,
      entityType: record.entityType,
      entityId: record.entityId,
      operationType: record.operationType,
      baseVersion: record.baseVersion,
      payload: record.payload,
      occurredAt: record.occurredAt,
    })))
    totals.attempted += batch.length
    if (response.error) {
      await markBatchError(db, batch, response.error, now())
      break
    }
    const byId = new Map((response.data ?? []).map(result => [result.operationId, result]))
    for (let index = 0; index < batch.length; index += 1) {
      const record = batch[index]
      const groupKey = selectedKeys[index]
      const group = groups.get(groupKey)
      const result = byId.get(record.operationId) ?? { result: 'rejected', conflict: { code: 'missing_result' } }
      const updated = await updateAttempt(db, record, result, now())
      if (updated.state === 'synced') totals.synced += 1
      else if (updated.state === 'conflict') totals.conflicts += 1
      else totals.rejected += 1
      group.shift()
      if (updated.state !== 'synced' && group.length) {
        await blockDependentOperations(db, group, record, now())
        group.length = 0
      }
      if (!group.length) groups.delete(groupKey)
    }
  }
  return totals
}

export function pushPilotV2Outbox(options = {}) {
  const key = options.databaseName ?? V2_DB_NAME
  const previous = pushChains.get(key) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => flushPilotV2Outbox(options))
  const tracked = next.finally(() => {
    if (pushChains.get(key) === tracked) pushChains.delete(key)
  })
  pushChains.set(key, tracked)
  return tracked
}

export async function readPilotV2Operation(operationId, { databaseName = V2_DB_NAME } = {}) {
  if (!operationId) return null
  return (await openV2Database({ name: databaseName })).get(V2_STORES.outbox, operationId)
}

function hasConvergedRemoteSnapshot(operation, recordsByStore) {
  const code = operation.conflict?.code
  const records = operation.entityType === 'habit'
    ? recordsByStore.habits
    : operation.entityType === 'habitLog'
      ? recordsByStore.habitLogs
      : recordsByStore.rewardClaims
  const local = records.find(record => record.id === operation.entityId)

  // Older reward-claim writes could be rejected while the canonical rule was
  // still being created. The compatibility writer subsequently upserts the
  // logical claim with a server id. A different id with the same owner-scoped
  // rule/period proves that the claim now exists remotely and lets us archive
  // the obsolete rejection without discarding the canonical record.
  if (operation.state === 'rejected'
    && operation.entityType === 'rewardClaim'
    && code === 'invalid_payload') {
    const ruleId = operation.payload?.ruleId
    const periodKey = operation.payload?.periodKey
    return Boolean(ruleId && periodKey && records.some(record => (
      record.id !== operation.entityId
      && record.ruleId === ruleId
      && record.periodKey === periodKey
    )))
  }

  if (operation.state !== 'conflict') return false

  if (code === 'occurrence_conflict') {
    const remoteEntityId = operation.conflict?.remoteEntityId
    return Boolean(remoteEntityId
      && !local
      && records.some(record => record.id === remoteEntityId))
  }
  if (code === 'not_found') return !local
  if (code === 'tombstone_wins') {
    return Boolean(local?.deletedAt && Number(local.version) === Number(operation.serverVersion))
  }
  if (code === 'version_mismatch') {
    return Boolean(local && Number(local.version) === Number(operation.serverVersion))
  }
  return false
}

/**
 * Archives only terminal conflicts whose canonical remote snapshot is already
 * present locally. The operation remains in IndexedDB as content-free audit
 * evidence and can never be retried by the outbox flusher.
 */
export async function acknowledgeResolvedPilotV2Operations({
  databaseName = V2_DB_NAME,
  now = new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const [operations, habits, habitLogs, rewardClaims] = await Promise.all([
    db.getAll(V2_STORES.outbox),
    db.getAll(V2_STORES.habits),
    db.getAll(V2_STORES.habitLogs),
    db.getAll(V2_STORES.rewardClaims),
  ])
  const unresolved = operations.filter(operation => (
    TERMINAL_STATES.has(operation.state) && SUPPORTED_ENTITIES.has(operation.entityType)
  ))
  const recordsByStore = { habits, habitLogs, rewardClaims }
  const converged = unresolved.filter(operation => hasConvergedRemoteSnapshot(operation, recordsByStore))
  if (!converged.length) return { acknowledged: 0, remaining: unresolved.length }

  const tx = db.transaction(V2_STORES.outbox, 'readwrite')
  for (const operation of converged) {
    await tx.store.put({
      ...operation,
      state: 'acknowledged',
      resolution: 'remote_snapshot',
      acknowledgedAt: now,
      updatedAt: now,
    })
  }
  await tx.done
  return {
    acknowledged: converged.length,
    remaining: unresolved.length - converged.length,
  }
}

export async function loadLatestPilotV2HabitRestoreState({ databaseName = V2_DB_NAME } = {}) {
  const db = await openV2Database({ name: databaseName })
  const [habits, operations] = await Promise.all([
    db.getAll(V2_STORES.habits),
    db.getAll(V2_STORES.outbox),
  ])
  const tombstone = habits
    .filter(habit => habit.deletedAt)
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)))[0] ?? null
  if (!tombstone) return { state: 'idle', habit: null, operationId: null }

  const tombstoneVersion = Math.max(0, Number(tombstone.version) || 0)
  const latestRestore = operations
    .filter(operation => operation.entityType === 'habit'
      && operation.entityId === tombstone.id
      && operation.operationType === 'restore'
      && Number(operation.baseVersion) >= tombstoneVersion)
    .sort(compareEntityOperations)
    .at(-1)
  if (!latestRestore) return { state: 'idle', habit: tombstone, operationId: null }
  if (latestRestore.state === 'pending') {
    return { state: 'queued', habit: null, operationId: latestRestore.operationId }
  }
  if (['conflict', 'rejected', 'blocked'].includes(latestRestore.state)) {
    return { state: 'failed', habit: null, operationId: latestRestore.operationId }
  }
  return { state: 'done', habit: null, operationId: latestRestore.operationId }
}

export async function loadLatestPilotV2HabitTombstone(options = {}) {
  const candidate = await loadLatestPilotV2HabitRestoreState(options)
  return candidate.state === 'idle' ? candidate.habit : null
}

export async function isLatestPilotV2Operation(operationId, { databaseName = V2_DB_NAME } = {}) {
  const db = await openV2Database({ name: databaseName })
  const target = await db.get(V2_STORES.outbox, operationId)
  if (!target) return false
  const sameEntity = (await db.getAll(V2_STORES.outbox))
    .filter(record => record.entityType === target.entityType && record.entityId === target.entityId)
    .sort(compareEntityOperations)
  return sameEntity.at(-1)?.operationId === operationId
}

export async function pullPilotV2Changes({
  databaseName = V2_DB_NAME,
  sync = syncV2,
  limit = 100,
  now = new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const deviceId = await getPilotV2DeviceId({ databaseName, now })
  const saved = await db.get(V2_STORES.syncCursors, deviceId)
  const response = await sync.pull(deviceId, {
    receivedAt: saved?.receivedAt,
    operationId: saved?.operationId,
  }, limit)
  if (response.error) return { data: null, error: response.error }
  const data = response.data ?? { changes: [], cursor: {}, hasMore: false }
  const rehydrationRequired = Boolean(data.rehydrationRequired)
  const pendingById = new Map()
  for (const change of [...(saved?.pendingChanges ?? []), ...(data.changes ?? [])]) {
    const key = change.operationId
      ?? `${change.entityType}:${change.entityId}:${change.operationType}:${change.receivedAt ?? ''}`
    pendingById.set(key, change)
  }
  const pendingChanges = [...pendingById.values()]
  await db.put(V2_STORES.syncCursors, {
    deviceId,
    // A retained-ledger gap must never advance the durable local cursor before
    // the owner-scoped canonical snapshot has finished successfully.
    receivedAt: rehydrationRequired
      ? saved?.receivedAt ?? null
      : data.cursor?.receivedAt ?? saved?.receivedAt ?? null,
    operationId: rehydrationRequired
      ? saved?.operationId ?? null
      : data.cursor?.operationId ?? saved?.operationId ?? null,
    rehydrationRequired,
    rehydrationCursor: rehydrationRequired ? data.cursor ?? null : null,
    retentionFloor: rehydrationRequired ? data.retentionFloor ?? null : null,
    snapshotPending: pendingChanges.length > 0 || rehydrationRequired,
    pendingChanges,
    updatedAt: now,
  })
  return {
    data: {
      ...data,
      pendingChanges,
      snapshotPending: pendingChanges.length > 0 || rehydrationRequired,
    },
    error: null,
  }
}

export async function acknowledgePilotV2Snapshot({
  databaseName = V2_DB_NAME,
  sync = syncV2,
  now = new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const deviceId = await getPilotV2DeviceId({ databaseName, now })
  const saved = await db.get(V2_STORES.syncCursors, deviceId)
  if (!saved) return null
  let acknowledgedCursor = null
  if (saved.rehydrationRequired) {
    acknowledgedCursor = saved.rehydrationCursor
    if (!acknowledgedCursor?.receivedAt || !acknowledgedCursor?.operationId) {
      return { ...saved, rehydrationAcknowledged: false, error: 'missing_rehydration_cursor' }
    }
    const response = await sync.acknowledgeRehydration(deviceId, acknowledgedCursor)
    if (response.error || !response.data?.acknowledged) {
      return {
        ...saved,
        rehydrationAcknowledged: false,
        error: response.error?.code ?? response.error?.message ?? 'rehydration_ack_failed',
      }
    }
  }
  const acknowledged = {
    ...saved,
    receivedAt: acknowledgedCursor?.receivedAt ?? saved.receivedAt ?? null,
    operationId: acknowledgedCursor?.operationId ?? saved.operationId ?? null,
    rehydrationRequired: false,
    rehydrationCursor: null,
    retentionFloor: null,
    rehydrationAcknowledged: Boolean(acknowledgedCursor),
    snapshotPending: false,
    pendingChanges: [],
    snapshotAcknowledgedAt: now,
    updatedAt: now,
  }
  await db.put(V2_STORES.syncCursors, acknowledged)
  return acknowledged
}

export async function recordPilotV2RemoteSnapshot(cloud, {
  databaseName = V2_DB_NAME,
} = {}) {
  if (!cloud) return
  const db = await openV2Database({ name: databaseName })
  const tx = db.transaction([
    V2_STORES.habits,
    V2_STORES.habitLogs,
    V2_STORES.rewardClaims,
  ], 'readwrite')
  for (const habit of cloud.habits ?? []) {
    const { logs = {}, ...habitRecord } = clone(habit)
    await tx.objectStore(V2_STORES.habits).put({ ...habitRecord, migrationQuality: 'native' })
    for (const log of Object.values(logs)) {
      if (!log?.id) continue
      const outcome = normalizeHabitLogOutcome(log)
      const logStore = tx.objectStore(V2_STORES.habitLogs)
      const occurrenceKey = log.occurrenceKey ?? `date:${log.localDate}`
      const existingId = await logStore.index('by-occurrence').getKey([habit.id, occurrenceKey])
      if (existingId && existingId !== log.id) await logStore.delete(existingId)
      await logStore.put({
        ...log,
        habitId: habit.id,
        occurrenceKey,
        status: outcome.status,
        minimumUsed: outcome.minimumUsed,
        contextCodes: outcome.contextCodes,
        migrationQuality: 'native',
      })
    }
  }
  for (const claim of cloud.rewards?.claims ?? []) {
    if (!claim?.id) continue
    const claimStore = tx.objectStore(V2_STORES.rewardClaims)
    if (claim.ruleId && claim.periodKey) {
      const existingId = await claimStore.index('by-rule-period').getKey([
        claim.ruleId,
        claim.periodKey,
      ])
      if (existingId && existingId !== claim.id) await claimStore.delete(existingId)
    }
    await claimStore.put(clone(claim))
  }
  await tx.done
}

import { V2_BACKFILL_KEY } from './local/v2.migration.js'
import { openV2Database, readV2Stores, V2_DB_NAME, V2_STORES } from './local/v2.database.js'
import { syncV2 } from './supabase/syncV2.service.js'
import { isLocalSupabaseUrl, SUPABASE_URL } from './supabase/config.js'

export const SYNC_V2_PILOT_SESSION_KEY = 'sync-v2-pilot-session'

const PILOT_OPERATION_STATES = Object.freeze(['pending', 'conflict', 'rejected', 'blocked'])

export const SYNC_V2_PILOT_MATRIX = Object.freeze([
  { id: 'habit-meta', action: 'Editar nombre o mínimo', expected: 'Versión nueva o conflicto explícito' },
  { id: 'habit-pause', action: 'Pausar en dispositivo A', expected: 'Dispositivo B recibe estado pausado' },
  { id: 'log-occurrence', action: 'Registrar el mismo día en A y B', expected: 'Una ocurrencia y conflicto explícito' },
  { id: 'delete-restore', action: 'Eliminar y luego restaurar', expected: 'Tombstone gana; restaurar crea otra versión' },
  { id: 'reward-claim', action: 'Reclamar el mismo periodo en A y B', expected: 'Una sola recompensa reclamada' },
])

/**
 * Returns counts and readiness flags only. It intentionally excludes entity
 * payloads, notes, names and check-in content from operational diagnostics.
 */
export async function collectSyncV2PilotReadiness({
  databaseName = V2_DB_NAME,
  sync = syncV2,
  endpoint = SUPABASE_URL,
} = {}) {
  const stores = await readV2Stores({ name: databaseName })
  const migration = stores[V2_STORES.migrationMeta]
    .find(record => record.key === V2_BACKFILL_KEY) ?? null
  const localEndpoint = isLocalSupabaseUrl(endpoint)
  let serverQuality = null
  let error = localEndpoint ? null : { code: 'non_local_endpoint' }
  if (localEndpoint) {
    try {
      const result = await sync.quality()
      serverQuality = result.data
      error = result.error
    } catch (caught) {
      error = caught
    }
  }
  const missingLegacyLogs = Number(serverQuality?.missingLegacyLogs)
  const missingReminderSchedules = Number(serverQuality?.missingReminderSchedules)
  const pilotEntityTypes = new Set(['habit', 'habitLog', 'rewardClaim'])
  const resolvedStates = new Set(['synced', 'acknowledged'])
  const unresolvedOperations = stores[V2_STORES.outbox]
    .filter(operation => pilotEntityTypes.has(operation.entityType) && !resolvedStates.has(operation.state))
  const operationStates = unresolvedOperations.reduce((counts, operation) => {
    const state = PILOT_OPERATION_STATES.includes(operation.state) ? operation.state : 'unknown'
    counts[state] += 1
    return counts
  }, {
    pending: 0,
    conflict: 0,
    rejected: 0,
    blocked: 0,
    unknown: 0,
  })
  const unresolvedOperationCount = unresolvedOperations.length
  const backfillReady = migration?.status === 'completed'
    && !error
    && Number.isFinite(missingLegacyLogs)
    && Number.isFinite(missingReminderSchedules)
    && missingLegacyLogs === 0
    && missingReminderSchedules === 0
  const converged = backfillReady && unresolvedOperationCount === 0

  return {
    ready: converged,
    backfillReady,
    converged,
    environment: localEndpoint ? 'localhost' : 'blocked_non_local',
    local: {
      migrationStatus: migration?.status ?? 'not_started',
      habits: stores[V2_STORES.habits].length,
      habitLogs: stores[V2_STORES.habitLogs].length,
      unresolvedOperations: unresolvedOperationCount,
      // Kept while existing diagnostics migrate to the clearer name above.
      pendingOperations: unresolvedOperationCount,
      operationStates,
      deviceCursors: stores[V2_STORES.syncCursors].length,
      inferredLogs: migration?.quality?.inferredLogs ?? 0,
    },
    server: serverQuality ?? null,
    serverReachable: !error,
    errorCode: error?.code ?? (error ? 'quality_unavailable' : null),
    matrix: SYNC_V2_PILOT_MATRIX,
  }
}

export async function loadSyncV2PilotSession({ databaseName = V2_DB_NAME } = {}) {
  const stores = await readV2Stores({ name: databaseName })
  return stores[V2_STORES.migrationMeta]
    .find(record => record.key === SYNC_V2_PILOT_SESSION_KEY) ?? null
}

export async function saveSyncV2PilotSession(completedIds, {
  databaseName = V2_DB_NAME,
  now = new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const previous = await db.get(V2_STORES.migrationMeta, SYNC_V2_PILOT_SESSION_KEY)
  const allowedIds = new Set(SYNC_V2_PILOT_MATRIX.map(item => item.id))
  const validIds = [...completedIds].filter(id => allowedIds.has(id))
  const checks = Object.fromEntries(validIds.map(id => [id, {
    completedAt: previous?.checks?.[id]?.completedAt ?? now,
  }]))
  const record = {
    key: SYNC_V2_PILOT_SESSION_KEY,
    status: validIds.length === SYNC_V2_PILOT_MATRIX.length ? 'completed' : 'in_progress',
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    checks,
  }
  await db.put(V2_STORES.migrationMeta, record)
  return record
}

export async function resetSyncV2PilotSession({ databaseName = V2_DB_NAME } = {}) {
  const db = await openV2Database({ name: databaseName })
  await db.delete(V2_STORES.migrationMeta, SYNC_V2_PILOT_SESSION_KEY)
}

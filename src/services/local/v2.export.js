import { currentTimezone } from '@/features/habits/domain.js'
import { storage } from '@/services/storage.js'
import { GOALS_DB_NAME, readGoalsStores } from './goals.database.js'
import { deleteV2Database, readV2Stores, V2_DB_NAME, V2_STORES } from './v2.database.js'
import { V2_BACKFILL_KEY } from './v2.migration.js'
import { V2_OWNER_BINDING_KEY } from './v2.ownership.js'

const PILOT_SESSION_KEY = 'sync-v2-pilot-session'

export async function exportV2Data({
  databaseName = V2_DB_NAME,
  goalsDatabaseName = GOALS_DB_NAME,
  legacySnapshot = storage.exportData(),
  legacyGoals,
  exportedAt = new Date().toISOString(),
} = {}) {
  const [stores, goals] = await Promise.all([
    readV2Stores({ name: databaseName }),
    legacyGoals === undefined ? readGoalsStores({ name: goalsDatabaseName }) : legacyGoals,
  ])
  const migration = stores[V2_STORES.migrationMeta]
    .find(record => record.key === V2_BACKFILL_KEY) ?? null
  const pilotSession = stores[V2_STORES.migrationMeta]
    .find(record => record.key === PILOT_SESSION_KEY) ?? null
  const exportStores = {
    ...stores,
    [V2_STORES.migrationMeta]: stores[V2_STORES.migrationMeta]
      .filter(record => record.key !== V2_OWNER_BINDING_KEY),
  }

  return {
    _schema: 2,
    _database: V2_DB_NAME,
    _exportedAt: exportedAt,
    timezone: currentTimezone(),
    migration,
    pilotSession,
    stores: exportStores,
    legacy: legacySnapshot,
    legacyGoals: goals,
  }
}

/**
 * Deletes only the opt-in v2 IndexedDB database for this browser. The legacy
 * reader and its localStorage data are deliberately left untouched so this is
 * a reversible pilot cleanup, not an account/cloud deletion.
 */
export async function deleteV2PilotData(databaseName = V2_DB_NAME) {
  await deleteV2Database(databaseName)
  return { deletedDatabase: databaseName, legacyPreserved: true }
}

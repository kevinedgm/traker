import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { storage } from '@/services/storage.js'
import { deleteV2Database, openV2Database, readV2Stores, V2_STORES } from './v2.database.js'
import { exportV2Data, deleteV2PilotData } from './v2.export.js'
import { backfillLocalV2 } from './v2.migration.js'
import { deleteGoalsDatabase, GOALS_STORES, openGoalsDatabase } from './goals.database.js'

const DB_NAME = 'traker-v2-migration-test'
const GOALS_DB_NAME = 'traker-goals-export-test'

function legacySnapshot() {
  return {
    _schema: 1,
    habits: [{
      id: 'habit-1',
      name: 'Leer',
      createdAt: '2026-08-28T12:00:00.000Z',
      isActive: true,
      goalIds: ['goal-1', 'goal-2'],
      schedule: {
        id: 'schedule-1',
        kind: 'weekdays',
        timezone: 'America/Mexico_City',
        daysOfWeek: [1, 3, 5],
      },
      logs: {
        2: {
          id: 'log-1',
          clientOperationId: 'operation-1',
          level: 1,
          note: 'dato local',
          loggedAt: '2026-08-29T13:00:00.000Z',
        },
      },
    }],
    checkins: { checkins: [{ id: 'checkin-1', localDate: '2026-08-29' }] },
    dayClosures: { closures: [{ id: 'closure-1', localDate: '2026-08-29' }] },
    flexibleGroups: { groups: [{
      id: 'group-1', name: 'Movimiento', minimumCount: 1,
      memberIds: ['habit-1'], createdAt: '2026-08-28T12:00:00.000Z',
    }] },
    rewards: {
      rewards: [{
        id: 'reward-1',
        name: 'Café',
        rule: {
          id: 'rule-1',
          ruleType: 'all',
          period: 'week',
          sources: [{ id: 'source-1', type: 'habit', sourceId: 'habit-1' }],
        },
      }],
      claims: [{ id: 'claim-1', ruleId: 'rule-1', periodKey: '2026-W35' }],
    },
    settings: { notificationDailyBudget: 2 },
  }
}

describe('local v2 pilot backfill', () => {
  beforeEach(async () => {
    localStorage.clear()
    await deleteV2Database(DB_NAME)
    await deleteGoalsDatabase(GOALS_DB_NAME)
  })

  afterEach(async () => {
    await deleteV2Database(DB_NAME)
    await deleteGoalsDatabase(GOALS_DB_NAME)
  })

  it('preserves every legacy domain and records uncertain dates', async () => {
    const report = await backfillLocalV2({
      databaseName: DB_NAME,
      legacySnapshot: legacySnapshot(),
      includeGoals: false,
      now: () => '2026-08-29T15:00:00.000Z',
    })
    const stores = await readV2Stores({ name: DB_NAME })

    expect(report).toMatchObject({
      status: 'completed',
      quality: { inferredLogs: 1, preservedLegacyLogs: 1 },
    })
    expect(stores[V2_STORES.habits]).toHaveLength(1)
    expect(stores[V2_STORES.habitGoalLinks]).toHaveLength(2)
    expect(stores[V2_STORES.habitLogs][0]).toMatchObject({
      habitId: 'habit-1',
      localDate: '2026-08-29',
      legacyDayNumber: 2,
      legacyLevel: 1,
      migrationQuality: 'inferred',
    })
    expect(stores[V2_STORES.dailyCheckins]).toHaveLength(1)
    expect(stores[V2_STORES.dayClosures]).toHaveLength(1)
    expect(stores[V2_STORES.flexibleGroups]).toHaveLength(1)
    expect(stores[V2_STORES.flexibleGroupMembers][0]).toMatchObject({ groupId: 'group-1', habitId: 'habit-1' })
    expect(stores[V2_STORES.rewardRules]).toHaveLength(1)
    expect(stores[V2_STORES.rewardSources]).toHaveLength(1)
    expect(stores[V2_STORES.rewardClaims]).toHaveLength(1)
  })

  it('is idempotent and keeps the first completed report', async () => {
    const first = await backfillLocalV2({
      databaseName: DB_NAME,
      legacySnapshot: legacySnapshot(),
      includeGoals: false,
    })
    const second = await backfillLocalV2({
      databaseName: DB_NAME,
      legacySnapshot: { ...legacySnapshot(), habits: [] },
      includeGoals: false,
    })
    const stores = await readV2Stores({ name: DB_NAME })

    expect(second).toEqual(first)
    expect(stores[V2_STORES.habits]).toHaveLength(1)
    expect(stores[V2_STORES.habitLogs]).toHaveLength(1)
  })

  it('exports v2 plus the rollback snapshot and deletes only pilot data', async () => {
    const legacy = legacySnapshot()
    storage.write(storage.KEYS.HABITS, legacy.habits)
    await backfillLocalV2({
      databaseName: DB_NAME,
      legacySnapshot: legacy,
      includeGoals: false,
    })
    const db = await openV2Database({ name: DB_NAME })
    await db.put(V2_STORES.migrationMeta, {
      key: 'sync-v2-pilot-session',
      status: 'in_progress',
      checks: { 'habit-meta': { completedAt: '2026-08-29T15:30:00.000Z' } },
    })
    await db.put(V2_STORES.migrationMeta, {
      key: 'sync-v2-owner-binding',
      ownerFingerprint: 'must-not-leave-this-browser',
    })
    const goalsDb = await openGoalsDatabase({ name: GOALS_DB_NAME })
    await goalsDb.put(GOALS_STORES.goals, { id: 'goal-export', title: 'Meta local' })
    await goalsDb.put(GOALS_STORES.outbox, {
      operationId: 'goal-operation',
      entityType: 'goal',
      entityId: 'goal-export',
      createdAt: '2026-08-29T15:00:00.000Z',
    })

    const exported = await exportV2Data({
      databaseName: DB_NAME,
      goalsDatabaseName: GOALS_DB_NAME,
      legacySnapshot: legacy,
      exportedAt: '2026-08-29T16:00:00.000Z',
    })
    expect(exported).toMatchObject({
      _schema: 2,
      _database: 'traker-v2',
      _exportedAt: '2026-08-29T16:00:00.000Z',
      migration: { status: 'completed' },
      pilotSession: {
        status: 'in_progress',
        checks: { 'habit-meta': { completedAt: '2026-08-29T15:30:00.000Z' } },
      },
      legacy: { _schema: 1 },
    })
    expect(exported.stores[V2_STORES.outbox]).toEqual([])
    expect(JSON.stringify(exported)).not.toContain('must-not-leave-this-browser')
    expect(exported.legacyGoals[GOALS_STORES.goals]).toEqual([{ id: 'goal-export', title: 'Meta local' }])
    expect(exported.legacyGoals[GOALS_STORES.outbox]).toHaveLength(1)

    await expect(deleteV2PilotData(DB_NAME)).resolves.toEqual({
      deletedDatabase: DB_NAME,
      legacyPreserved: true,
    })
    expect(storage.read(storage.KEYS.HABITS, [])).toHaveLength(1)
  })
})

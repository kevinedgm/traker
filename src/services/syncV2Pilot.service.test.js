import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteV2Database, openV2Database, V2_STORES } from './local/v2.database.js'
import { V2_BACKFILL_KEY } from './local/v2.migration.js'
import {
  collectSyncV2PilotReadiness,
  loadSyncV2PilotSession,
  resetSyncV2PilotSession,
  saveSyncV2PilotSession,
  SYNC_V2_PILOT_MATRIX,
} from './syncV2Pilot.service.js'

const DB_NAME = 'traker-v2-readiness-test'
const LOCAL_ENDPOINT = 'http://127.0.0.1:55321'

describe('sync v2 pilot readiness', () => {
  beforeEach(() => deleteV2Database(DB_NAME))
  afterEach(() => deleteV2Database(DB_NAME))

  it('reports only counts and becomes ready with zero server gaps', async () => {
    const db = await openV2Database({ name: DB_NAME })
    await db.put(V2_STORES.habits, { id: 'habit-1', name: 'private name' })
    await db.put(V2_STORES.migrationMeta, {
      key: V2_BACKFILL_KEY,
      status: 'completed',
      quality: { inferredLogs: 2 },
    })
    const sync = {
      quality: vi.fn().mockResolvedValue({
        data: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
        error: null,
      }),
    }

    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: LOCAL_ENDPOINT,
    })

    expect(report).toMatchObject({
      ready: true,
      backfillReady: true,
      converged: true,
      environment: 'localhost',
      local: { migrationStatus: 'completed', habits: 1, inferredLogs: 2 },
      serverReachable: true,
    })
    expect(JSON.stringify(report)).not.toContain('private name')
    expect(SYNC_V2_PILOT_MATRIX).toHaveLength(5)
  })

  it('does not declare readiness when the quality RPC is unavailable', async () => {
    const sync = {
      quality: vi.fn().mockResolvedValue({ data: null, error: { code: 'offline' } }),
    }
    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: LOCAL_ENDPOINT,
    })
    expect(report).toMatchObject({ ready: false, serverReachable: false, errorCode: 'offline' })
  })

  it('does not treat an incomplete server report as zero gaps', async () => {
    const db = await openV2Database({ name: DB_NAME })
    await db.put(V2_STORES.migrationMeta, { key: V2_BACKFILL_KEY, status: 'completed' })
    const sync = { quality: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: LOCAL_ENDPOINT,
    })
    expect(report.ready).toBe(false)
  })

  it('blocks non-local endpoints without calling the private quality RPC', async () => {
    const sync = { quality: vi.fn() }
    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: 'https://project.supabase.co',
    })

    expect(sync.quality).not.toHaveBeenCalled()
    expect(report).toMatchObject({
      ready: false,
      environment: 'blocked_non_local',
      serverReachable: false,
      errorCode: 'non_local_endpoint',
    })
  })

  it('separates a complete backfill from convergence while the outbox is pending', async () => {
    const db = await openV2Database({ name: DB_NAME })
    await db.put(V2_STORES.migrationMeta, { key: V2_BACKFILL_KEY, status: 'completed' })
    await db.put(V2_STORES.outbox, {
      operationId: 'operation-1',
      entityType: 'habit',
      state: 'pending',
    })
    const sync = {
      quality: vi.fn().mockResolvedValue({
        data: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
        error: null,
      }),
    }

    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: LOCAL_ENDPOINT,
    })

    expect(report).toMatchObject({
      ready: false,
      backfillReady: true,
      converged: false,
      local: {
        unresolvedOperations: 1,
        pendingOperations: 1,
        operationStates: {
          pending: 1,
          conflict: 0,
          rejected: 0,
          blocked: 0,
          unknown: 0,
        },
      },
    })
  })

  it('reports content-free counts for every unresolved outbox state', async () => {
    const db = await openV2Database({ name: DB_NAME })
    await db.put(V2_STORES.migrationMeta, { key: V2_BACKFILL_KEY, status: 'completed' })
    for (const [index, state] of ['conflict', 'rejected', 'blocked', 'unexpected'].entries()) {
      await db.put(V2_STORES.outbox, {
        operationId: `operation-${index}`,
        entityType: 'habitLog',
        state,
        payload: { note: `private-${state}` },
      })
    }
    const sync = {
      quality: vi.fn().mockResolvedValue({
        data: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
        error: null,
      }),
    }

    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: LOCAL_ENDPOINT,
    })

    expect(report.local).toMatchObject({
      unresolvedOperations: 4,
      operationStates: { conflict: 1, rejected: 1, blocked: 1, unknown: 1 },
    })
    expect(JSON.stringify(report)).not.toContain('private-')
  })

  it('persists, restores and resets the manual pilot session', async () => {
    const completed = new Set([SYNC_V2_PILOT_MATRIX[0].id, SYNC_V2_PILOT_MATRIX[1].id])
    const saved = await saveSyncV2PilotSession(completed, {
      databaseName: DB_NAME,
      now: '2026-08-29T17:00:00.000Z',
    })

    expect(saved).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-08-29T17:00:00.000Z',
      checks: {
        'habit-meta': { completedAt: '2026-08-29T17:00:00.000Z' },
        'habit-pause': { completedAt: '2026-08-29T17:00:00.000Z' },
      },
    })
    await expect(loadSyncV2PilotSession({ databaseName: DB_NAME })).resolves.toEqual(saved)

    await resetSyncV2PilotSession({ databaseName: DB_NAME })
    await expect(loadSyncV2PilotSession({ databaseName: DB_NAME })).resolves.toBeNull()
  })

  it('does not count a separately managed legacy goal outbox as v2 work', async () => {
    const db = await openV2Database({ name: DB_NAME })
    await db.put(V2_STORES.migrationMeta, { key: V2_BACKFILL_KEY, status: 'completed' })
    await db.put(V2_STORES.outbox, {
      operationId: 'goal-operation-1',
      entityType: 'goal',
      state: 'pending',
    })
    const sync = {
      quality: vi.fn().mockResolvedValue({
        data: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
        error: null,
      }),
    }

    const report = await collectSyncV2PilotReadiness({
      databaseName: DB_NAME,
      sync,
      endpoint: LOCAL_ENDPOINT,
    })

    expect(report).toMatchObject({ ready: true, local: { pendingOperations: 0 } })
  })
})

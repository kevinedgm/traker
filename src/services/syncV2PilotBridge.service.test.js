import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteV2Database, openV2Database, readV2Stores, V2_STORES } from './local/v2.database.js'
import {
  acknowledgeResolvedPilotV2Operations,
  acknowledgePilotV2Snapshot,
  flushPilotV2Outbox,
  getPilotV2DeviceId,
  isLatestPilotV2Operation,
  loadLatestPilotV2HabitRestoreState,
  loadLatestPilotV2HabitTombstone,
  pullPilotV2Changes,
  recordPilotV2RemoteSnapshot,
  stagePilotV2Mutation,
  toPilotV2Operation,
} from './syncV2PilotBridge.service.js'

const DB_NAME = 'traker-v2-pilot-bridge-test'
const NOW = '2026-08-29T18:00:00.000Z'

function habit(overrides = {}) {
  return {
    id: 'habit-1',
    name: 'Caminar',
    minimumVersion: 'Cinco minutos',
    icon: 'Footprints',
    color: '#637F50',
    duration: 30,
    reminder: null,
    reminderDays: [1, 3, 5],
    isActive: true,
    lifecycleStatus: 'active',
    version: 1,
    createdAt: '2026-08-28T12:00:00.000Z',
    updatedAt: NOW,
    schedule: { timezone: 'America/Mexico_City' },
    logs: {},
    ...overrides,
  }
}

function log(overrides = {}) {
  return {
    id: 'log-1',
    clientOperationId: 'client-operation-1',
    localDate: '2026-08-29',
    timezone: 'America/Mexico_City',
    occurrenceKey: 'date:2026-08-29',
    level: 1,
    note: 'contenido local',
    loggedAt: NOW,
    version: 1,
    ...overrides,
  }
}

describe('sync v2 pilot bridge', () => {
  beforeEach(() => deleteV2Database(DB_NAME))
  afterEach(() => deleteV2Database(DB_NAME))

  it('maps legacy mutations to bounded v2 operations', () => {
    const create = toPilotV2Operation('upsert-habit', { habit: habit() }, {
      operationId: 'operation-1',
      occurredAt: NOW,
    })
    const entry = toPilotV2Operation('upsert-entry', { habitId: 'habit-1', day: 2, log: log() }, {
      operationId: 'operation-2',
      occurredAt: NOW,
    })

    expect(create).toMatchObject({
      operationId: 'operation-1',
      entityType: 'habit',
      entityId: 'habit-1',
      baseVersion: 0,
      payload: { name: 'Caminar', timezone: 'America/Mexico_City' },
    })
    expect(entry).toMatchObject({
      entityType: 'habitLog',
      entityId: 'log-1',
      baseVersion: 0,
      payload: {
        habitId: 'habit-1',
        status: 'partial',
        minimumUsed: true,
        contextCodes: [],
        note: 'contenido local',
      },
    })
    expect(toPilotV2Operation('upsert-checkin', {})).toBeNull()
    expect(toPilotV2Operation('restore-habit', {
      habit: habit({ version: 4 }),
      baseVersion: 3,
    }, {
      operationId: 'operation-restore',
      occurredAt: NOW,
    })).toMatchObject({
      entityType: 'habit',
      entityId: 'habit-1',
      operationType: 'restore',
      baseVersion: 3,
    })
  })

  it('stages the local copy and marks an accepted operation as synced', async () => {
    const staged = await stagePilotV2Mutation('upsert-habit', { habit: habit() }, {
      databaseName: DB_NAME,
      operationId: 'operation-1',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => ({
          operationId: operation.operationId,
          result: 'applied',
          newVersion: 1,
          conflict: null,
        })),
        error: null,
      })),
    }

    const totals = await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })
    const stores = await readV2Stores({ name: DB_NAME })

    expect(staged.state).toBe('pending')
    expect(totals).toEqual({ attempted: 1, synced: 1, conflicts: 0, rejected: 0 })
    expect(stores[V2_STORES.habits][0]).toMatchObject({ id: 'habit-1', migrationQuality: 'native' })
    expect(stores[V2_STORES.outbox][0]).toMatchObject({
      operationId: 'operation-1',
      state: 'synced',
      serverVersion: 1,
    })
    expect(sync.push).toHaveBeenCalledWith(expect.stringMatching(/^browser-/), [expect.objectContaining({
      operationId: 'operation-1',
      payload: expect.objectContaining({ name: 'Caminar' }),
    })])
  })

  it('keeps a local tombstone available until a versioned restore is staged', async () => {
    await stagePilotV2Mutation('delete-habit', {
      habitId: 'habit-1',
      baseVersion: 1,
      habit: habit(),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-delete',
      now: NOW,
    })
    const tombstone = await loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })
    expect(tombstone).toMatchObject({
      id: 'habit-1',
      deletedAt: NOW,
      version: 2,
    })

    await stagePilotV2Mutation('restore-habit', {
      habit: { ...tombstone, version: 3, updatedAt: '2026-08-29T18:05:00.000Z' },
      baseVersion: 2,
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-restore',
      now: '2026-08-29T18:05:00.000Z',
    })
    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => ({
          operationId: operation.operationId,
          result: 'applied',
          newVersion: operation.baseVersion + 1,
        })),
        error: null,
      })),
    }
    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => '2026-08-29T18:05:00.000Z' })
    const restored = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.habits, 'habit-1')

    expect(restored).toMatchObject({
      isActive: true,
      lifecycleStatus: 'active',
      deletedAt: null,
      version: 3,
    })
    await expect(loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })).resolves.toBeNull()
  })

  it('deduplicates a pending restore and exposes a durable queued state after remount', async () => {
    await stagePilotV2Mutation('delete-habit', {
      habitId: 'habit-1',
      baseVersion: 1,
      habit: habit(),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-delete',
      now: NOW,
    })
    const tombstone = await loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })
    const payload = {
      habit: { ...tombstone, version: 3, updatedAt: '2026-08-29T18:05:00.000Z' },
      baseVersion: 2,
    }
    const first = await stagePilotV2Mutation('restore-habit', payload, {
      databaseName: DB_NAME,
      operationId: 'operation-restore-first',
      now: '2026-08-29T18:05:00.000Z',
    })
    const duplicate = await stagePilotV2Mutation('restore-habit', payload, {
      databaseName: DB_NAME,
      operationId: 'operation-restore-second',
      now: '2026-08-29T18:06:00.000Z',
    })

    expect(duplicate.operationId).toBe(first.operationId)
    await expect(loadLatestPilotV2HabitRestoreState({ databaseName: DB_NAME })).resolves.toMatchObject({
      state: 'queued',
      habit: null,
      operationId: 'operation-restore-first',
    })
    const restores = (await readV2Stores({ name: DB_NAME }))[V2_STORES.outbox]
      .filter(record => record.operationType === 'restore')
    expect(restores).toHaveLength(1)

    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => ({
          operationId: operation.operationId,
          result: 'applied',
          newVersion: operation.baseVersion + 1,
        })),
        error: null,
      })),
    }
    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => '2026-08-29T18:07:00.000Z' })

    expect(sync.push).toHaveBeenCalledTimes(2)
    expect(sync.push.mock.calls.flatMap(([, operations]) => operations)
      .filter(operation => operation.operationType === 'restore')).toHaveLength(1)
    await expect(loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })).resolves.toBeNull()
  })

  it('offers a new tombstone after a later delete even when an older restore is synced', async () => {
    await stagePilotV2Mutation('delete-habit', {
      habitId: 'habit-1',
      baseVersion: 1,
      habit: habit(),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-delete-first',
      now: NOW,
    })
    const firstTombstone = await loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })
    await stagePilotV2Mutation('restore-habit', {
      habit: { ...firstTombstone, version: 3 },
      baseVersion: 2,
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-restore-first',
      now: '2026-08-29T18:05:00.000Z',
    })
    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => ({
          operationId: operation.operationId,
          result: 'applied',
          newVersion: operation.baseVersion + 1,
        })),
        error: null,
      })),
    }
    await flushPilotV2Outbox({
      databaseName: DB_NAME,
      sync,
      now: () => '2026-08-29T18:06:00.000Z',
    })

    await stagePilotV2Mutation('delete-habit', {
      habitId: 'habit-1',
      baseVersion: 3,
      habit: habit({ version: 3 }),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-delete-second',
      now: '2026-08-29T18:07:00.000Z',
    })

    await expect(loadLatestPilotV2HabitRestoreState({ databaseName: DB_NAME })).resolves.toMatchObject({
      state: 'idle',
      habit: expect.objectContaining({ id: 'habit-1', version: 4 }),
      operationId: null,
    })
  })

  it('preserves the local tombstone and disables retry after a restore conflict', async () => {
    await stagePilotV2Mutation('delete-habit', {
      habitId: 'habit-1',
      baseVersion: 1,
      habit: habit(),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-delete',
      now: NOW,
    })
    const tombstone = await loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })
    await stagePilotV2Mutation('restore-habit', {
      habit: { ...tombstone, version: 3 },
      baseVersion: 2,
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-restore-conflict',
      now: '2026-08-29T18:05:00.000Z',
    })
    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => operation.operationId === 'operation-delete'
          ? { operationId: operation.operationId, result: 'applied', newVersion: 2 }
          : {
              operationId: operation.operationId,
              result: 'conflict',
              newVersion: 4,
              conflict: { code: 'version_mismatch', remoteVersion: 4 },
            }),
        error: null,
      })),
    }

    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => '2026-08-29T18:06:00.000Z' })
    const preserved = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.habits, 'habit-1')

    expect(preserved).toMatchObject({ id: 'habit-1', deletedAt: NOW, version: 2 })
    await expect(loadLatestPilotV2HabitTombstone({ databaseName: DB_NAME })).resolves.toBeNull()
  })

  it('retains an explicit conflict instead of retrying or overwriting it', async () => {
    await stagePilotV2Mutation('upsert-habit', { habit: habit({ version: 2 }) }, {
      databaseName: DB_NAME,
      operationId: 'operation-conflict',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockResolvedValue({
        data: [{
          operationId: 'operation-conflict',
          result: 'conflict',
          newVersion: 4,
          conflict: { code: 'version_mismatch', remoteVersion: 4 },
        }],
        error: null,
      }),
    }

    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })
    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })
    const record = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.outbox, 'operation-conflict')

    expect(record).toMatchObject({
      state: 'conflict',
      serverVersion: 4,
      conflict: { code: 'version_mismatch' },
    })
    expect(sync.push).toHaveBeenCalledTimes(1)
  })

  it('acknowledges an occurrence conflict only after the canonical snapshot converges', async () => {
    await stagePilotV2Mutation('upsert-entry', {
      habitId: 'habit-1',
      log: log({ id: 'local-conflict-log' }),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-occurrence-conflict',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockResolvedValue({
        data: [{
          operationId: 'operation-occurrence-conflict',
          result: 'conflict',
          newVersion: 1,
          conflict: {
            code: 'occurrence_conflict',
            remoteVersion: 1,
            remoteEntityId: 'remote-canonical-log',
          },
        }],
        error: null,
      }),
    }
    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })

    await expect(acknowledgeResolvedPilotV2Operations({ databaseName: DB_NAME }))
      .resolves.toEqual({ acknowledged: 0, remaining: 1 })

    await recordPilotV2RemoteSnapshot({
      habits: [{
        ...habit(),
        logs: { 2: log({ id: 'remote-canonical-log' }) },
      }],
    }, { databaseName: DB_NAME })
    await expect(acknowledgeResolvedPilotV2Operations({
      databaseName: DB_NAME,
      now: '2026-08-29T18:07:00.000Z',
    })).resolves.toEqual({ acknowledged: 1, remaining: 0 })

    const record = await (await openV2Database({ name: DB_NAME }))
      .get(V2_STORES.outbox, 'operation-occurrence-conflict')
    expect(record).toMatchObject({
      state: 'acknowledged',
      resolution: 'remote_snapshot',
      acknowledgedAt: '2026-08-29T18:07:00.000Z',
    })
    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })
    expect(sync.push).toHaveBeenCalledTimes(1)
  })

  it('acknowledges an obsolete rejected claim only after its canonical rule-period snapshot exists', async () => {
    const claim = {
      id: 'local-rejected-claim',
      ruleId: 'rule-1',
      periodKey: '2026-W35',
      unlockedAt: NOW,
    }
    await stagePilotV2Mutation('upsert-reward-claim', { claim }, {
      databaseName: DB_NAME,
      operationId: 'operation-rejected-claim',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockResolvedValue({
        data: [{
          operationId: 'operation-rejected-claim',
          result: 'rejected',
          newVersion: null,
          conflict: { code: 'invalid_payload' },
        }],
        error: null,
      }),
    }
    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })

    await expect(acknowledgeResolvedPilotV2Operations({ databaseName: DB_NAME }))
      .resolves.toEqual({ acknowledged: 0, remaining: 1 })

    await recordPilotV2RemoteSnapshot({
      rewards: {
        claims: [{ ...claim, id: 'remote-canonical-claim' }],
      },
    }, { databaseName: DB_NAME })

    await expect(acknowledgeResolvedPilotV2Operations({
      databaseName: DB_NAME,
      now: '2026-08-29T18:08:00.000Z',
    })).resolves.toEqual({ acknowledged: 1, remaining: 0 })

    const record = await (await openV2Database({ name: DB_NAME }))
      .get(V2_STORES.outbox, 'operation-rejected-claim')
    expect(record).toMatchObject({
      state: 'acknowledged',
      resolution: 'remote_snapshot',
      acknowledgedAt: '2026-08-29T18:08:00.000Z',
    })
  })

  it('sends dependent versions in separate ordered RPC rounds', async () => {
    await stagePilotV2Mutation('upsert-habit', { habit: habit({ version: 1 }) }, {
      databaseName: DB_NAME,
      operationId: 'operation-create',
      now: NOW,
    })
    await stagePilotV2Mutation('upsert-habit', { habit: habit({ version: 2, name: 'Caminar afuera' }) }, {
      databaseName: DB_NAME,
      operationId: 'operation-update',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => ({
          operationId: operation.operationId,
          result: 'applied',
          newVersion: operation.baseVersion + 1,
        })),
        error: null,
      })),
    }

    const totals = await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })

    expect(totals).toEqual({ attempted: 2, synced: 2, conflicts: 0, rejected: 0 })
    expect(sync.push).toHaveBeenCalledTimes(2)
    expect(sync.push.mock.calls[0][1]).toEqual([expect.objectContaining({
      operationId: 'operation-create',
      baseVersion: 0,
    })])
    expect(sync.push.mock.calls[1][1]).toEqual([expect.objectContaining({
      operationId: 'operation-update',
      baseVersion: 1,
    })])
  })

  it('blocks later local versions when their prerequisite conflicts', async () => {
    await stagePilotV2Mutation('upsert-habit', { habit: habit({ version: 2 }) }, {
      databaseName: DB_NAME,
      operationId: 'operation-stale',
      now: NOW,
    })
    await stagePilotV2Mutation('upsert-habit', { habit: habit({ version: 3 }) }, {
      databaseName: DB_NAME,
      operationId: 'operation-dependent',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockResolvedValue({
        data: [{
          operationId: 'operation-stale',
          result: 'conflict',
          newVersion: 5,
          conflict: { code: 'version_mismatch', remoteVersion: 5 },
        }],
        error: null,
      }),
    }

    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })
    const stores = await readV2Stores({ name: DB_NAME })
    const byId = new Map(stores[V2_STORES.outbox].map(record => [record.operationId, record]))

    expect(sync.push).toHaveBeenCalledTimes(1)
    expect(byId.get('operation-stale').state).toBe('conflict')
    expect(byId.get('operation-dependent')).toMatchObject({
      state: 'blocked',
      conflict: { code: 'blocked_by_prior_operation', operationId: 'operation-stale' },
    })
  })

  it('preserves creation-before-redemption order for the same reward claim', async () => {
    const baseClaim = {
      id: 'claim-1',
      ruleId: 'rule-1',
      periodKey: '2026-W35',
      unlockedAt: NOW,
      usedAt: null,
    }
    await stagePilotV2Mutation('upsert-reward-claim', { claim: baseClaim }, {
      databaseName: DB_NAME,
      operationId: 'claim-create',
      now: NOW,
    })
    await stagePilotV2Mutation('upsert-reward-claim', {
      claim: { ...baseClaim, usedAt: '2026-08-29T18:05:00.000Z' },
    }, {
      databaseName: DB_NAME,
      operationId: 'claim-redeem',
      now: NOW,
    })
    const sync = {
      push: vi.fn().mockImplementation(async (_deviceId, operations) => ({
        data: operations.map(operation => ({
          operationId: operation.operationId,
          result: operation.operationId === 'claim-create' ? 'applied' : 'duplicate',
          newVersion: 1,
        })),
        error: null,
      })),
    }

    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })

    expect(sync.push.mock.calls[0][1][0].operationId).toBe('claim-create')
    expect(sync.push.mock.calls[1][1][0].operationId).toBe('claim-redeem')
    await expect(isLatestPilotV2Operation('claim-create', { databaseName: DB_NAME })).resolves.toBe(false)
    await expect(isLatestPilotV2Operation('claim-redeem', { databaseName: DB_NAME })).resolves.toBe(true)
  })

  it('keeps network failures pending with an attempt count', async () => {
    await stagePilotV2Mutation('upsert-entry', { habitId: 'habit-1', day: 2, log: log() }, {
      databaseName: DB_NAME,
      operationId: 'operation-offline',
      now: NOW,
    })
    const sync = { push: vi.fn().mockResolvedValue({ data: null, error: { code: 'offline' } }) }

    await flushPilotV2Outbox({ databaseName: DB_NAME, sync, now: () => NOW })
    const record = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.outbox, 'operation-offline')

    expect(record).toMatchObject({ state: 'pending', attempts: 1, lastErrorCode: 'offline' })
  })

  it('persists a stable device cursor after a content-free pull', async () => {
    const deviceId = await getPilotV2DeviceId({
      databaseName: DB_NAME,
      now: NOW,
      createId: () => 'device-test',
    })
    const sync = {
      pull: vi.fn().mockResolvedValue({
        data: {
          changes: [{ entityType: 'habit', entityId: 'habit-1', operationType: 'delete', result: 'applied' }],
          cursor: { receivedAt: NOW, operationId: '00000000-0000-4000-8000-000000000001' },
          hasMore: false,
        },
        error: null,
      }),
    }

    const result = await pullPilotV2Changes({ databaseName: DB_NAME, sync, now: NOW })
    const cursor = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.syncCursors, deviceId)

    expect(result.data.changes).toHaveLength(1)
    expect(result.data.pendingChanges).toHaveLength(1)
    expect(sync.pull).toHaveBeenCalledWith(deviceId, { receivedAt: undefined, operationId: undefined }, 100)
    expect(cursor).toMatchObject({ deviceId, receivedAt: NOW, snapshotPending: true })
  })

  it('replays an unacknowledged signal after a failed snapshot and clears it only on ack', async () => {
    await getPilotV2DeviceId({
      databaseName: DB_NAME,
      now: NOW,
      createId: () => 'snapshot-retry',
    })
    const change = {
      operationId: '00000000-0000-4000-8000-000000000001',
      entityType: 'habit',
      entityId: 'habit-1',
      operationType: 'upsert',
      result: 'applied',
    }
    const sync = {
      pull: vi.fn()
        .mockResolvedValueOnce({
          data: {
            changes: [change],
            cursor: { receivedAt: NOW, operationId: change.operationId },
            hasMore: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            changes: [],
            cursor: { receivedAt: NOW, operationId: change.operationId },
            hasMore: false,
          },
          error: null,
        }),
    }

    await pullPilotV2Changes({ databaseName: DB_NAME, sync, now: NOW })
    const retry = await pullPilotV2Changes({ databaseName: DB_NAME, sync, now: '2026-08-29T18:01:00.000Z' })
    expect(retry.data.changes).toEqual([])
    expect(retry.data.pendingChanges).toEqual([change])

    const acknowledged = await acknowledgePilotV2Snapshot({
      databaseName: DB_NAME,
      now: '2026-08-29T18:02:00.000Z',
    })
    expect(acknowledged).toMatchObject({ snapshotPending: false, pendingChanges: [] })
  })

  it('keeps a compacted-ledger cursor pending until the canonical snapshot is acknowledged', async () => {
    const deviceId = await getPilotV2DeviceId({
      databaseName: DB_NAME,
      now: NOW,
      createId: () => 'returning-device',
    })
    const cursor = {
      receivedAt: '2026-08-29T17:59:00.000Z',
      operationId: '00000000-0000-4000-8000-000000000010',
    }
    const pullSync = {
      pull: vi.fn().mockResolvedValue({
        data: {
          changes: [],
          cursor,
          retentionFloor: {
            receivedAt: '2026-01-01T00:00:00.000Z',
            operationId: '00000000-0000-4000-8000-000000000001',
          },
          hasMore: false,
          rehydrationRequired: true,
        },
        error: null,
      }),
    }

    const pulled = await pullPilotV2Changes({ databaseName: DB_NAME, sync: pullSync, now: NOW })
    const beforeAck = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.syncCursors, deviceId)

    expect(pulled.data).toMatchObject({ rehydrationRequired: true, snapshotPending: true })
    expect(beforeAck).toMatchObject({
      receivedAt: null,
      operationId: null,
      rehydrationRequired: true,
      rehydrationCursor: cursor,
    })

    const ackSync = {
      acknowledgeRehydration: vi.fn().mockResolvedValue({
        data: { acknowledged: true, cursor },
        error: null,
      }),
    }
    const acknowledged = await acknowledgePilotV2Snapshot({
      databaseName: DB_NAME,
      sync: ackSync,
      now: '2026-08-29T18:02:00.000Z',
    })

    expect(ackSync.acknowledgeRehydration).toHaveBeenCalledWith(deviceId, cursor)
    expect(acknowledged).toMatchObject({
      receivedAt: cursor.receivedAt,
      operationId: cursor.operationId,
      rehydrationRequired: false,
      rehydrationAcknowledged: true,
      snapshotPending: false,
    })
  })

  it('preserves the old cursor when rehydration acknowledgement fails', async () => {
    const deviceId = await getPilotV2DeviceId({
      databaseName: DB_NAME,
      now: NOW,
      createId: () => 'retry-rehydration',
    })
    const cursor = {
      receivedAt: NOW,
      operationId: '00000000-0000-4000-8000-000000000011',
    }
    await pullPilotV2Changes({
      databaseName: DB_NAME,
      now: NOW,
      sync: {
        pull: vi.fn().mockResolvedValue({
          data: { changes: [], cursor, hasMore: false, rehydrationRequired: true },
          error: null,
        }),
      },
    })

    const failed = await acknowledgePilotV2Snapshot({
      databaseName: DB_NAME,
      sync: {
        acknowledgeRehydration: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'offline' },
        }),
      },
      now: '2026-08-29T18:02:00.000Z',
    })
    const stored = await (await openV2Database({ name: DB_NAME })).get(V2_STORES.syncCursors, deviceId)

    expect(failed).toMatchObject({ rehydrationAcknowledged: false, error: 'offline' })
    expect(stored).toMatchObject({
      receivedAt: null,
      operationId: null,
      rehydrationRequired: true,
      snapshotPending: true,
    })
  })

  it('records an owner-scoped remote snapshot without creating outbox work', async () => {
    await recordPilotV2RemoteSnapshot({
      habits: [{ ...habit(), logs: { 2: log() } }],
      rewards: { claims: [{ id: 'claim-1', ruleId: 'rule-1', periodKey: '2026-W35' }] },
    }, { databaseName: DB_NAME })
    const stores = await readV2Stores({ name: DB_NAME })

    expect(stores[V2_STORES.habits]).toHaveLength(1)
    expect(stores[V2_STORES.habitLogs][0]).toMatchObject({ id: 'log-1', habitId: 'habit-1' })
    expect(stores[V2_STORES.rewardClaims]).toHaveLength(1)
    expect(stores[V2_STORES.outbox]).toEqual([])
  })

  it('reconciles a remote canonical occurrence that has a different local id', async () => {
    await stagePilotV2Mutation('upsert-entry', {
      habitId: 'habit-1',
      day: 2,
      log: log({ id: 'local-log' }),
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-local-log',
      now: NOW,
    })

    await recordPilotV2RemoteSnapshot({
      habits: [{
        ...habit(),
        logs: { 2: log({ id: 'remote-canonical-log', note: 'servidor' }) },
      }],
    }, { databaseName: DB_NAME })
    const stores = await readV2Stores({ name: DB_NAME })

    expect(stores[V2_STORES.habitLogs]).toEqual([
      expect.objectContaining({ id: 'remote-canonical-log', note: 'servidor' }),
    ])
  })

  it('reconciles a remote canonical reward claim that has a different local id', async () => {
    await stagePilotV2Mutation('upsert-reward-claim', {
      claim: {
        id: 'local-claim',
        ruleId: 'rule-1',
        periodKey: '2026-W35',
        unlockedAt: NOW,
      },
    }, {
      databaseName: DB_NAME,
      operationId: 'operation-local-claim',
      now: NOW,
    })

    await recordPilotV2RemoteSnapshot({
      rewards: {
        claims: [{
          id: 'remote-canonical-claim',
          ruleId: 'rule-1',
          periodKey: '2026-W35',
          unlockedAt: NOW,
        }],
      },
    }, { databaseName: DB_NAME })
    const stores = await readV2Stores({ name: DB_NAME })

    expect(stores[V2_STORES.rewardClaims]).toEqual([
      expect.objectContaining({ id: 'remote-canonical-claim' }),
    ])
  })
})

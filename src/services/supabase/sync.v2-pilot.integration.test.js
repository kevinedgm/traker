import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const bridge = vi.hoisted(() => ({
  stagePilotV2Mutation: vi.fn(),
  pushPilotV2Outbox: vi.fn(),
  readPilotV2Operation: vi.fn(),
  isLatestPilotV2Operation: vi.fn(),
  pullPilotV2Changes: vi.fn(),
  recordPilotV2RemoteSnapshot: vi.fn(),
  ensureV2LocalOwner: vi.fn(),
}))
const habits = vi.hoisted(() => ({
  deleteHabit: vi.fn(),
  deleteHabitLog: vi.fn(),
  fetchHabitGoalLinks: vi.fn(),
  fetchHabitLogs: vi.fn(),
  fetchHabitSchedules: vi.fn(),
  fetchHabits: vi.fn(),
  upsertHabitBundle: vi.fn(),
  upsertHabitLog: vi.fn(),
}))
const rewards = vi.hoisted(() => ({
  upsertRewardBundle: vi.fn(),
  upsertRewardClaim: vi.fn(),
}))

vi.mock('@/config/features.js', () => ({
  features: { syncV2Pilot: true, goals: false },
}))
vi.mock('./config.js', () => ({ isSupabaseConfigured: true }))
vi.mock('../syncV2PilotBridge.service.js', () => bridge)
vi.mock('./habits.service.js', () => habits)
vi.mock('./auth.service.js', () => ({ getUser: vi.fn().mockResolvedValue({ id: 'user-1' }) }))
vi.mock('./checkins.service.js', () => ({}))
vi.mock('./rewards.service.js', () => rewards)
vi.mock('./flexibleGroups.service.js', () => ({}))
vi.mock('./settings.service.js', () => ({}))
vi.mock('./dayClosures.service.js', () => ({}))

import { push, stopReconnectSync } from './sync.service.js'

describe('canonical sync with the local v2 pilot bridge', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    bridge.stagePilotV2Mutation.mockResolvedValue({ operationId: 'operation-1' })
    bridge.ensureV2LocalOwner.mockResolvedValue({ allowed: true, status: 'matched' })
    bridge.pushPilotV2Outbox.mockResolvedValue({ attempted: 1, synced: 1, conflicts: 0, rejected: 0 })
    bridge.readPilotV2Operation.mockResolvedValue({ operationId: 'operation-1', state: 'synced' })
    bridge.isLatestPilotV2Operation.mockResolvedValue(true)
    habits.deleteHabit.mockResolvedValue({ data: null, error: null })
    habits.deleteHabitLog.mockResolvedValue({ data: null, error: null })
    habits.upsertHabitBundle.mockResolvedValue({ data: {}, error: null })
    habits.upsertHabitLog.mockResolvedValue({ data: null, error: null })
    rewards.upsertRewardBundle.mockResolvedValue({ data: null, error: null })
    rewards.upsertRewardClaim.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => stopReconnectSync())

  it('keeps a v2 habit tombstone instead of issuing the legacy hard delete', async () => {
    const result = await push('delete-habit', { habitId: 'habit-1', baseVersion: 3 })

    expect(result).toEqual({ status: 'synced' })
    expect(bridge.stagePilotV2Mutation).toHaveBeenCalledWith('delete-habit', {
      habitId: 'habit-1',
      baseVersion: 3,
    })
    expect(bridge.pushPilotV2Outbox).toHaveBeenCalledOnce()
    expect(habits.deleteHabit).not.toHaveBeenCalled()
  })

  it('keeps both transports local when another account owns this copy', async () => {
    bridge.ensureV2LocalOwner.mockResolvedValue({ allowed: false, status: 'owner_mismatch' })

    const result = await push('upsert-habit', {
      habit: { id: 'habit-1', name: 'No mezclar', version: 2 },
    })

    expect(result).toEqual({ status: 'blocked', error: 'local_owner_mismatch' })
    expect(bridge.pushPilotV2Outbox).not.toHaveBeenCalled()
    expect(habits.upsertHabitBundle).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('traker:sync-queue'))).toEqual([
      expect.objectContaining({ type: 'upsert-habit', v2OperationId: 'operation-1' }),
    ])
  })

  it('runs the compatibility upsert only after a v2 restore is accepted', async () => {
    const payload = {
      habit: { id: 'habit-1', name: 'Restaurado', version: 4 },
      baseVersion: 3,
    }

    await expect(push('restore-habit', payload)).resolves.toEqual({ status: 'synced' })

    expect(bridge.stagePilotV2Mutation).toHaveBeenCalledWith('restore-habit', payload)
    expect(habits.upsertHabitBundle).toHaveBeenCalledWith(payload.habit, 'user-1')
    expect(habits.deleteHabit).not.toHaveBeenCalled()
  })

  it('does not let the legacy writer overwrite an explicit v2 conflict', async () => {
    bridge.readPilotV2Operation.mockResolvedValue({
      operationId: 'operation-1',
      state: 'conflict',
      conflict: { code: 'version_mismatch', remoteVersion: 4 },
    })

    const result = await push('upsert-habit', {
      habit: { id: 'habit-1', name: 'Obsoleto', version: 3 },
    })

    expect(result).toEqual({
      status: 'conflict',
      conflict: { code: 'version_mismatch', remoteVersion: 4 },
      operationId: 'operation-1',
    })
    expect(habits.upsertHabitBundle).not.toHaveBeenCalled()
  })

  it('writes only the canonical log after v2 accepts it', async () => {
    const payload = {
      habitId: 'habit-1',
      day: 2,
      log: { id: 'log-1', version: 1, localDate: '2026-08-29' },
    }

    await expect(push('upsert-entry', payload)).resolves.toEqual({ status: 'synced' })

    expect(bridge.readPilotV2Operation).toHaveBeenCalledWith('operation-1')
    expect(habits.upsertHabitLog).toHaveBeenCalledWith(
      'habit-1',
      payload.log,
      'user-1',
    )
  })

  it('skips an older compatibility write when a newer local version already exists', async () => {
    bridge.isLatestPilotV2Operation.mockResolvedValue(false)

    const result = await push('upsert-habit', {
      habit: { id: 'habit-1', name: 'Versión anterior', version: 1 },
    })

    expect(result).toEqual({
      status: 'synced',
      operationId: 'operation-1',
      compatibilityWrite: 'superseded',
    })
    expect(habits.upsertHabitBundle).not.toHaveBeenCalled()
  })

  it('keeps the local queue and v2 outbox aligned when the browser is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    await expect(push('delete-habit', { habitId: 'habit-1', baseVersion: 2 })).resolves.toEqual({ status: 'queued' })

    expect(bridge.stagePilotV2Mutation).toHaveBeenCalledOnce()
    expect(bridge.pushPilotV2Outbox).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('traker:sync-queue'))).toEqual([
      expect.objectContaining({
        type: 'delete-habit',
        v2OperationId: 'operation-1',
      }),
    ])
  })

  it('keeps a 503 failure durable and schedules bounded automatic retry metadata', async () => {
    const failure = Object.assign(new Error('Service unavailable'), { status: 503 })
    habits.upsertHabitBundle.mockResolvedValueOnce({ data: null, error: failure })

    await expect(push('upsert-habit', {
      habit: { id: 'habit-503', name: 'Conservar', version: 2 },
    })).resolves.toEqual({ status: 'error', error: 'Service unavailable' })

    expect(JSON.parse(localStorage.getItem('traker:sync-queue'))).toEqual([
      expect.objectContaining({
        type: 'upsert-habit',
        v2OperationId: 'operation-1',
        retryAttempts: 1,
        lastErrorCode: '503',
        retryAt: expect.any(String),
      }),
    ])
  })

  it('keeps a reprogrammed schedule intact in the offline queue', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const payload = {
      habit: {
        id: 'habit-weekly',
        name: 'Practicar inglés',
        version: 2,
        schedule: {
          id: 'schedule-weekly',
          kind: 'times_per_week',
          timezone: 'America/Mexico_City',
          periodMinimum: 3,
          periodTarget: 4,
          periodExtra: 5,
          effectiveFrom: '2026-08-31',
          version: 2,
        },
      },
    }

    await expect(push('upsert-habit', payload)).resolves.toEqual({ status: 'queued' })

    expect(bridge.stagePilotV2Mutation).toHaveBeenCalledWith('upsert-habit', payload)
    expect(JSON.parse(localStorage.getItem('traker:sync-queue'))).toEqual([
      expect.objectContaining({
        type: 'upsert-habit',
        payload: expect.objectContaining({
          habit: expect.objectContaining({
            schedule: expect.objectContaining({
              kind: 'times_per_week',
              periodMinimum: 3,
              periodTarget: 4,
              periodExtra: 5,
            }),
          }),
        }),
      }),
    ])
  })

  it('deduplicates a queued restore by habit while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const payload = {
      habit: { id: 'habit-1', name: 'Restaurado', version: 4 },
      baseVersion: 3,
    }

    await push('restore-habit', payload)
    await push('restore-habit', payload)

    const queue = JSON.parse(localStorage.getItem('traker:sync-queue'))
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ type: 'restore-habit', v2OperationId: 'operation-1' })
  })

  it('does not replay a direct log delete after the v2 tombstone is accepted', async () => {
    const payload = {
      habitId: 'habit-1',
      day: 2,
      log: { id: 'log-1', version: 2 },
    }

    await expect(push('delete-entry', payload)).resolves.toEqual({ status: 'synced' })
    expect(habits.deleteHabitLog).not.toHaveBeenCalled()
    expect(localStorage.getItem('traker:sync-queue')).toBeNull()
  })

  it('creates the legacy reward rule before pushing its dependent v2 claim', async () => {
    const order = []
    bridge.stagePilotV2Mutation.mockImplementation(async type => (
      type === 'upsert-reward-claim' ? { operationId: 'claim-operation' } : null
    ))
    bridge.readPilotV2Operation.mockResolvedValue({
      operationId: 'claim-operation',
      state: 'synced',
    })
    rewards.upsertRewardBundle.mockImplementation(async () => {
      order.push('reward-rule')
      return { data: null, error: null }
    })
    rewards.upsertRewardClaim.mockImplementation(async () => {
      order.push('reward-claim')
      return { data: null, error: null }
    })

    const rewardWrite = push('upsert-reward', {
      reward: { id: 'reward-1', rule: { id: 'rule-1' } },
    })
    const claimWrite = push('upsert-reward-claim', {
      claim: { id: 'claim-1', ruleId: 'rule-1', periodKey: 'day:2026-08-29' },
    })

    await expect(Promise.all([rewardWrite, claimWrite])).resolves.toEqual([
      { status: 'synced' },
      { status: 'synced' },
    ])
    expect(order).toEqual(['reward-rule', 'reward-claim'])
    expect(bridge.pushPilotV2Outbox).toHaveBeenCalledOnce()
  })
})

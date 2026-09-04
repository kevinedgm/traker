import { describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({ supabase: null }))

import { createSyncOperation, createSyncV2Client } from './syncV2.service.js'

describe('sync v2 client', () => {
  it('creates a bounded operation envelope', () => {
    expect(createSyncOperation({
      operationId: 'operation-1',
      entityType: 'habit',
      entityId: 'habit-1',
      operationType: 'delete',
      baseVersion: -4,
      payload: {},
      occurredAt: '2026-08-29T12:00:00.000Z',
    })).toEqual({
      operationId: 'operation-1',
      entityType: 'habit',
      entityId: 'habit-1',
      operationType: 'delete',
      baseVersion: 0,
      payload: {},
      occurredAt: '2026-08-29T12:00:00.000Z',
    })
  })

  it('maps push, pull, quality and rehydration acknowledgement to the RPC contract', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    const sync = createSyncV2Client(client)
    const operations = [{ operationId: 'operation-1' }]

    await sync.push('device-a', operations)
    await sync.pull('device-a', { receivedAt: '2026-08-29T12:00:00Z', operationId: 'operation-0' }, 20)
    await sync.quality()
    await sync.acknowledgeRehydration('device-a', {
      receivedAt: '2026-08-29T13:00:00Z',
      operationId: 'operation-1',
    })

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'traker_apply_sync_operations', {
      p_device_id: 'device-a',
      p_operations: operations,
    })
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'traker_pull_sync_changes', {
      p_device_id: 'device-a',
      p_after_received_at: '2026-08-29T12:00:00Z',
      p_after_operation_id: 'operation-0',
      p_limit: 20,
    })
    expect(client.rpc).toHaveBeenNthCalledWith(3, 'traker_sync_v2_quality')
    expect(client.rpc).toHaveBeenNthCalledWith(4, 'traker_acknowledge_sync_rehydration', {
      p_device_id: 'device-a',
      p_received_at: '2026-08-29T13:00:00Z',
      p_operation_id: 'operation-1',
    })
  })

  it('refuses oversized batches before a network call', async () => {
    const client = { rpc: vi.fn() }
    const result = await createSyncV2Client(client).push('device-a', Array.from({ length: 101 }))
    expect(result.error.message).toContain('at most 100')
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

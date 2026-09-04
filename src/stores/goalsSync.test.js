import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createGoalsSyncStoreDefinition } from './goalsSync.js'

function repositoryWith(operations) {
  const pending = [...operations]
  return {
    listPendingOperations: vi.fn(async () => [...pending]),
    acknowledgeOperations: vi.fn(async ids => {
      for (const id of ids) {
        const index = pending.findIndex(operation => operation.operationId === id)
        if (index >= 0) pending.splice(index, 1)
      }
    }),
    markOperationAttempt: vi.fn(async () => {}),
    getSyncMeta: vi.fn(async () => null),
    setSyncMeta: vi.fn(async () => {}),
  }
}

const OPERATIONS = [
  { operationId: 'op-1', entityType: 'goal', entityId: 'goal-1', payload: {}, baseVersion: 0 },
  { operationId: 'op-2', entityType: 'goalAction', entityId: 'action-1', payload: {}, baseVersion: 0 },
]

describe('goals sync store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('acknowledges only operations applied or already processed remotely', async () => {
    const repository = repositoryWith(OPERATIONS)
    const pushBatch = vi.fn(async () => ({
      processedAt: '2026-08-26T12:00:00.000Z',
      results: [
        { operationId: 'op-1', status: 'applied' },
        { operationId: 'op-2', status: 'duplicate' },
      ],
    }))
    const useStore = createGoalsSyncStoreDefinition({
      id: 'sync-success', repository, pushBatch, cloudEnabled: true,
      online: () => true, getCurrentUser: async () => ({ id: 'user-1' }),
    })
    const store = useStore()

    await store.flush({ consented: true })

    expect(store.status).toBe('synced')
    expect(store.pendingCount).toBe(0)
    expect(repository.acknowledgeOperations).toHaveBeenCalledWith(['op-1', 'op-2'])
    expect(repository.setSyncMeta).toHaveBeenCalledOnce()
  })

  it('retains conflicting operations and exposes their remote version', async () => {
    const repository = repositoryWith(OPERATIONS)
    const useStore = createGoalsSyncStoreDefinition({
      id: 'sync-conflict', repository, cloudEnabled: true, online: () => true,
      getCurrentUser: async () => ({ id: 'user-1' }),
      pushBatch: async () => ({ results: [
        { operationId: 'op-1', status: 'applied' },
        { operationId: 'op-2', status: 'conflict', code: 'VERSION_CONFLICT', remoteVersion: 4 },
      ] }),
    })
    const store = useStore()

    await store.flush({ consented: true })

    expect(store.status).toBe('conflict')
    expect(store.pendingCount).toBe(1)
    expect(store.conflicts[0]).toMatchObject({ operationId: 'op-2', remoteVersion: 4 })
    expect(repository.markOperationAttempt).toHaveBeenCalledWith('op-2', 'VERSION_CONFLICT')
  })

  it('does not contact the cloud without consent', async () => {
    const repository = repositoryWith(OPERATIONS)
    const pushBatch = vi.fn()
    const useStore = createGoalsSyncStoreDefinition({ id: 'sync-local', repository, pushBatch, cloudEnabled: true })
    const store = useStore()

    await store.flush({ consented: false })

    expect(store.status).toBe('local')
    expect(store.pendingCount).toBe(2)
    expect(pushBatch).not.toHaveBeenCalled()
  })
})

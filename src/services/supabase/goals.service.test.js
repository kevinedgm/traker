import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('./client.js', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('./auth.service.js', () => ({ getUser: vi.fn() }))

import { pushGoalOperations } from './goals.service.js'

describe('goals Supabase service', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.rpc.mockImplementation(async (name, { p_operations: operations }) => ({
      data: {
        results: operations.map(operation => ({ operationId: operation.operationId, status: 'applied' })),
        processedAt: name === 'sync_traker_goal_milestone_operations' ? '2026-08-31T14:30:00.000Z' : '2026-08-31T14:29:00.000Z',
      },
      error: null,
    }))
  })

  it('routes milestone operations to the focused RPC and merges acknowledgements', async () => {
    const operations = [
      { operationId: 'op-goal', entityType: 'goal' },
      { operationId: 'op-milestone', entityType: 'goalMilestone' },
    ]

    const result = await pushGoalOperations(operations)

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'sync_traker_goal_operations', { p_operations: [operations[0]] })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'sync_traker_goal_milestone_operations', { p_operations: [operations[1]] })
    expect(result).toEqual({
      results: [
        { operationId: 'op-goal', status: 'applied' },
        { operationId: 'op-milestone', status: 'applied' },
      ],
      processedAt: '2026-08-31T14:30:00.000Z',
    })
  })
})

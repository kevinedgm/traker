import { describe, expect, it } from 'vitest'
import {
  fromRemoteFlexibleGroups,
  toRemoteFlexibleGroup,
} from './flexibleGroups.service.js'

describe('Supabase flexible group mappings', () => {
  it('maps the aggregate to the canonical database contract', () => {
    expect(toRemoteFlexibleGroup({
      id: 'group-1',
      name: 'Movimiento',
      period: 'week',
      minimumCount: 2,
      targetCount: 2,
      extraCount: 3,
      memberIds: ['habit-1', 'habit-2', 'habit-3'],
      version: 4,
      createdAt: '2026-08-31T12:00:00Z',
      updatedAt: '2026-08-31T13:00:00Z',
    }, 'user-1')).toMatchObject({
      id: 'group-1',
      user_id: 'user-1',
      minimum_count: 2,
      target_count: 2,
      extra_count: 3,
      version: 4,
    })
  })

  it('hydrates ordered active members and preserves a group tombstone', () => {
    const [group] = fromRemoteFlexibleGroups({
      groups: [{
        id: 'group-1', name: 'Movimiento', period: 'week', minimum_count: 1,
        target_count: 1, extra_count: 2, timezone: 'America/Mexico_City',
        status: 'archived', version: 2, created_at: '2026-08-31T12:00:00Z',
        updated_at: '2026-08-31T13:00:00Z', deleted_at: '2026-08-31T13:00:00Z',
      }],
      members: [
        { group_id: 'group-1', habit_id: 'habit-2', position: 1, deleted_at: null },
        { group_id: 'group-1', habit_id: 'habit-1', position: 0, deleted_at: null },
        { group_id: 'group-1', habit_id: 'habit-old', position: 0, deleted_at: '2026-08-31T12:30:00Z' },
      ],
    })
    expect(group).toMatchObject({ memberIds: ['habit-1', 'habit-2'], deletedAt: '2026-08-31T13:00:00Z' })
  })
})

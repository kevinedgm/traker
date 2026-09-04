import { describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
}))

vi.mock('./client.js', () => ({
  supabase: { from: query.from },
}))

import { fetchHabits } from './habits.service.js'

describe('visible habit snapshot', () => {
  it('excludes server tombstones before they reach the legacy reader', async () => {
    query.order.mockResolvedValue({ data: [{ id: 'active-habit' }], error: null })
    query.is.mockReturnValue({ order: query.order })
    query.select.mockReturnValue({ is: query.is })
    query.from.mockReturnValue({ select: query.select })

    await expect(fetchHabits()).resolves.toEqual({ data: [{ id: 'active-habit' }], error: null })

    expect(query.from).toHaveBeenCalledWith('habits')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })
})

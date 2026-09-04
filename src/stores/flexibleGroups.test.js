import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { push } from '@/services/supabase/sync.service.js'
import { useFlexibleGroupsStore } from './flexibleGroups.js'

vi.mock('@/services/supabase/sync.service.js', () => ({ push: vi.fn() }))

describe('flexible groups store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(push).mockClear()
  })

  it('creates and updates a valid aggregate', () => {
    const store = useFlexibleGroupsStore()
    const group = store.addGroup({ name: 'Movimiento', minimumCount: 1, memberIds: ['walk', 'stretch'] })
    expect(group).toBeTruthy()
    expect(push).toHaveBeenLastCalledWith('upsert-flexible-group', { group })

    const updated = store.updateGroup(group.id, { minimumCount: 2 })
    expect(updated.version).toBe(2)
    expect(updated.minimumCount).toBe(2)
  })

  it('keeps a local tombstone when a group is removed', () => {
    const store = useFlexibleGroupsStore()
    const group = store.addGroup({ name: 'Movimiento', memberIds: ['walk'] })
    vi.mocked(push).mockClear()

    store.removeGroup(group.id)

    expect(store.activeGroups).toHaveLength(0)
    expect(store.groups[0]).toMatchObject({ status: 'archived', deletedAt: expect.any(String) })
    expect(push).toHaveBeenCalledWith('delete-flexible-group', expect.objectContaining({ groupId: group.id, version: 2 }))
  })

  it('rejects empty groups', () => {
    const store = useFlexibleGroupsStore()
    expect(store.addGroup({ name: 'Vacío', memberIds: [] })).toBeNull()
    expect(push).not.toHaveBeenCalled()
  })
})

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { normalizeFlexibleGroup } from '@/features/flexibleGroups/domain.js'
import { push } from '@/services/supabase/sync.service.js'

function timestamp(value) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const useFlexibleGroupsStore = defineStore('flexibleGroups', () => {
  const groups = ref([])
  const activeGroups = computed(() => groups.value.filter(group => group.status === 'active' && !group.deletedAt))
  const activeMemberIds = computed(() => new Set(activeGroups.value.flatMap(group => group.memberIds)))

  function addGroup(input) {
    const group = normalizeFlexibleGroup(input)
    if (!group.name || !group.memberIds.length || group.minimumCount > group.memberIds.length) return null
    groups.value.push(group)
    push('upsert-flexible-group', { group })
    return group
  }

  function updateGroup(id, patch) {
    const index = groups.value.findIndex(group => group.id === id)
    if (index < 0) return null
    const current = groups.value[index]
    const group = normalizeFlexibleGroup({
      ...current,
      ...patch,
      id,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    })
    if (!group.name || !group.memberIds.length || group.minimumCount > group.memberIds.length) return null
    groups.value[index] = group
    push('upsert-flexible-group', { group })
    return group
  }

  function toggleGroup(id) {
    const group = groups.value.find(item => item.id === id)
    if (!group || group.deletedAt) return null
    return updateGroup(id, { status: group.status === 'active' ? 'paused' : 'active' })
  }

  function removeGroup(id) {
    const group = groups.value.find(item => item.id === id)
    if (!group) return null
    const now = new Date().toISOString()
    Object.assign(group, {
      status: 'archived',
      deletedAt: now,
      updatedAt: now,
      version: group.version + 1,
    })
    push('delete-flexible-group', { groupId: id, version: group.version, deletedAt: now })
    return group
  }

  function mergeFromCloud(cloudGroups = []) {
    for (const raw of cloudGroups) {
      const incoming = normalizeFlexibleGroup(raw)
      const local = groups.value.find(group => group.id === incoming.id)
      if (!local) groups.value.push(incoming)
      else if (timestamp(incoming.updatedAt) > timestamp(local.updatedAt)
        || incoming.version > local.version) Object.assign(local, incoming)
    }
  }

  function clearLocal() {
    groups.value = []
  }

  return {
    groups,
    activeGroups,
    activeMemberIds,
    addGroup,
    updateGroup,
    toggleGroup,
    removeGroup,
    mergeFromCloud,
    clearLocal,
  }
}, {
  persist: {
    key: 'traker:flexible-groups',
    pick: ['groups'],
    serialize: state => ({ groups: state.groups.map(normalizeFlexibleGroup) }),
    deserialize: saved => ({
      groups: Array.isArray(saved?.groups) ? saved.groups.map(normalizeFlexibleGroup) : [],
    }),
  },
})

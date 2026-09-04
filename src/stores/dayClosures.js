import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { localDateKey } from '@/features/habits/domain.js'
import { normalizeDayClosure } from '@/features/today/domain.js'
import { push } from '@services/supabase/sync.service.js'

function timestamp(value) {
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : 0
}

export const useDayClosuresStore = defineStore('dayClosures', () => {
  const closures = ref([])
  const recentClosures = computed(() => [...closures.value].sort((a, b) => b.localDate.localeCompare(a.localDate)))

  function forDate(localDate = localDateKey()) {
    return closures.value.find(closure => closure.localDate === localDate) ?? null
  }

  function closeDay(summary, options = {}) {
    const existing = forDate(summary.localDate)
    const next = normalizeDayClosure({
      ...existing,
      ...options,
      id: existing?.id,
      localDate: summary.localDate,
      status: options.status ?? summary.state,
      closedAt: existing?.closedAt,
      updatedAt: new Date().toISOString(),
      version: existing ? existing.version + 1 : 1,
    }, summary)
    if (existing) Object.assign(existing, next)
    else closures.value.push(next)
    push('upsert-day-closure', { closure: next })
    return next
  }

  function mergeFromCloud(cloudClosures = []) {
    for (const raw of cloudClosures) {
      const incoming = normalizeDayClosure(raw)
      const local = closures.value.find(closure => closure.id === incoming.id || closure.localDate === incoming.localDate)
      if (!local) {
        closures.value.push(incoming)
        continue
      }
      const incomingVersion = Number(incoming.version) || 0
      const localVersion = Number(local.version) || 0
      const isNewer = incomingVersion > localVersion
        || (incomingVersion === localVersion && timestamp(incoming.updatedAt) > timestamp(local.updatedAt))
      if (isNewer) {
        const privateTomorrowNote = local.tomorrowNote
        Object.assign(local, incoming, { tomorrowNote: privateTomorrowNote })
      }
    }
  }

  function clearAllClosures() {
    closures.value = []
  }

  return { closures, recentClosures, forDate, closeDay, mergeFromCloud, clearAllClosures }
}, {
  persist: {
    key: 'traker:day-closures',
    pick: ['closures'],
    serialize: state => ({ closures: state.closures.map(closure => normalizeDayClosure(closure)) }),
    deserialize: saved => ({ closures: (saved?.closures ?? []).map(closure => normalizeDayClosure(closure)) }),
  },
})

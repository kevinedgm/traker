import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { push } from '@services/supabase/sync.service.js'
import { currentTimezone, localDateKey } from '@/features/habits/domain.js'
import { normalizeDailyCheckin } from '@/features/checkins/domain.js'

function timestamp(value) {
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : 0
}

export const useCheckinsStore = defineStore(
  'checkins',
  () => {
    const checkins = ref([])

    const recentCheckins = computed(() => [...checkins.value]
      .filter(checkin => !checkin.deletedAt)
      .sort((a, b) => b.localDate.localeCompare(a.localDate)))

    function forDate(localDate = localDateKey()) {
      return checkins.value.find(checkin => checkin.localDate === localDate && !checkin.deletedAt) ?? null
    }

    function saveDailyCheckin(values, localDate = values?.localDate ?? localDateKey()) {
      const existing = forDate(localDate)
      const previousSyncScope = existing?.syncScope
      const now = new Date().toISOString()
      const next = normalizeDailyCheckin({
        ...existing,
        ...values,
        localDate,
        timezone: values?.timezone ?? existing?.timezone ?? currentTimezone(),
        id: existing?.id,
        clientOperationId: existing?.clientOperationId,
        createdAt: existing?.createdAt,
        updatedAt: now,
        version: existing ? existing.version + 1 : 1,
        syncStatus: values?.syncScope === 'cloud' ? 'pending' : 'local',
        syncError: null,
      }, { now, localDate })

      if (existing) Object.assign(existing, next)
      else checkins.value.push(next)

      if (next.syncScope === 'cloud') {
        Promise.resolve(push('upsert-checkin', { checkin: next })).then(result => {
          const current = forDate(next.localDate)
          if (!current || current.syncScope !== 'cloud') return
          current.syncStatus = result?.status === 'synced'
            ? 'synced'
            : result?.status === 'error' || result?.status === 'unavailable' ? 'error' : 'pending'
          current.syncError = current.syncStatus === 'error'
            ? (result?.error ?? 'No pudimos sincronizar todavía.')
            : null
        }).catch(error => {
          const current = forDate(next.localDate)
          if (!current || current.syncScope !== 'cloud') return
          current.syncStatus = 'error'
          current.syncError = error?.message ?? 'No pudimos sincronizar todavía.'
        })
      }
      else if (previousSyncScope === 'cloud') {
        push('delete-checkin', { localDate: next.localDate, version: next.version })
      }
      return next
    }

    function removeDailyCheckin(id) {
      const existing = checkins.value.find(checkin => checkin.id === id)
      if (!existing) return
      checkins.value = checkins.value.filter(checkin => checkin.id !== id)
      if (existing.syncScope === 'cloud') {
        push('delete-checkin', { localDate: existing.localDate, version: existing.version })
      }
    }

    function clearAllCheckins() {
      const cloudCheckins = checkins.value.filter(checkin => checkin.syncScope === 'cloud')
      checkins.value = []
      for (const checkin of cloudCheckins) {
        push('delete-checkin', { localDate: checkin.localDate, version: checkin.version })
      }
    }

    function mergeFromCloud(cloudCheckins = []) {
      for (const raw of cloudCheckins) {
        const incoming = normalizeDailyCheckin({ ...raw, syncScope: 'cloud' })
        const local = checkins.value.find(checkin => checkin.id === incoming.id || checkin.localDate === incoming.localDate)
        if (!local) {
          checkins.value.push(incoming)
          continue
        }
        if (local.syncScope === 'local_only') continue
        if (timestamp(incoming.updatedAt) > timestamp(local.updatedAt)) Object.assign(local, incoming)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('traker:checkin-sync', event => {
        const { localDate, status, error } = event.detail ?? {}
        const current = forDate(localDate)
        if (!current || current.syncScope !== 'cloud') return
        current.syncStatus = status === 'synced' ? 'synced' : status === 'error' ? 'error' : 'pending'
        current.syncError = current.syncStatus === 'error' ? (error ?? 'No pudimos sincronizar todavía.') : null
      })
    }

    return {
      checkins,
      recentCheckins,
      forDate,
      saveDailyCheckin,
      removeDailyCheckin,
      clearAllCheckins,
      mergeFromCloud,
    }
  },
  {
    persist: {
      key: 'traker:checkins',
      pick: ['checkins'],
      serialize(state) {
        return { checkins: state.checkins.map(checkin => normalizeDailyCheckin(checkin)) }
      },
      deserialize(saved) {
        return { checkins: (saved?.checkins ?? []).map(checkin => normalizeDailyCheckin(checkin)) }
      },
    },
  },
)

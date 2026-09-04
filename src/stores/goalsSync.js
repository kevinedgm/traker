import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isSupabaseEnabled } from '@/services/supabase/client.js'
import { getUser } from '@/services/supabase/auth.service.js'
import { pushGoalOperations } from '@/services/supabase/goals.service.js'
import { createGoalsRepository } from '@/services/local/goals.repository.js'

export function createGoalsSyncStoreDefinition({
  id = 'goals-sync',
  repository = createGoalsRepository(),
  pushBatch = pushGoalOperations,
  getCurrentUser = getUser,
  cloudEnabled = isSupabaseEnabled,
  online = () => typeof navigator === 'undefined' || navigator.onLine,
} = {}) {
  return defineStore(id, () => {
    const status = ref('local')
    const pendingCount = ref(0)
    const conflicts = ref([])
    const error = ref(null)
    const lastSyncedAt = ref(null)
    let activeFlush = null
    let stopMonitoring = null

    async function refresh() {
      pendingCount.value = (await repository.listPendingOperations()).length
      const saved = await repository.getSyncMeta('lastSyncedAt')
      lastSyncedAt.value = saved?.value ?? null
      return pendingCount.value
    }

    async function flush({ consented = false } = {}) {
      if (activeFlush) return activeFlush
      activeFlush = (async () => {
        error.value = null
        conflicts.value = []
        const operations = await repository.listPendingOperations()
        pendingCount.value = operations.length

        if (!consented || !cloudEnabled) { status.value = 'local'; return { status: status.value } }
        if (!online()) { status.value = 'offline'; return { status: status.value } }
        const user = await getCurrentUser()
        if (!user) { status.value = 'no_account'; return { status: status.value } }
        if (!operations.length) { status.value = 'synced'; return { status: status.value } }

        status.value = 'syncing'
        try {
          const response = await pushBatch(operations)
          const results = response?.results ?? []
          const acknowledged = results
            .filter(result => ['applied', 'duplicate'].includes(result.status))
            .map(result => result.operationId)
          const unresolved = results.filter(result => result.status === 'conflict')
          const failed = results.filter(result => result.status === 'error')
          await repository.acknowledgeOperations(acknowledged)
          for (const result of [...unresolved, ...failed]) {
            await repository.markOperationAttempt(result.operationId, result.code ?? result.status)
          }
          conflicts.value = unresolved
          pendingCount.value = (await repository.listPendingOperations()).length
          if (unresolved.length) status.value = 'conflict'
          else if (failed.length || pendingCount.value > 0) status.value = 'error'
          else {
            status.value = 'synced'
            lastSyncedAt.value = response.processedAt ?? new Date().toISOString()
            await repository.setSyncMeta('lastSyncedAt', lastSyncedAt.value)
          }
          return { status: status.value, acknowledged, conflicts: unresolved, failed }
        } catch (cause) {
          for (const operation of operations) await repository.markOperationAttempt(operation.operationId, cause?.message ?? 'SYNC_FAILED')
          error.value = { code: cause?.code ?? 'GOALS_SYNC_FAILED', message: cause?.message ?? 'No pudimos sincronizar las metas.' }
          status.value = 'error'
          pendingCount.value = operations.length
          return { status: status.value, error: error.value }
        }
      })()
      try { return await activeFlush } finally { activeFlush = null }
    }

    function start({ consentProvider }) {
      stop()
      const attempt = () => flush({ consented: Boolean(consentProvider()) })
      const onOnline = () => attempt()
      const onOutbox = () => attempt()
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOnline)
      window.addEventListener('traker:goals-outbox', onOutbox)
      stopMonitoring = () => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOnline)
        window.removeEventListener('traker:goals-outbox', onOutbox)
      }
      refresh().then(attempt).catch(() => {})
    }

    function stop() {
      stopMonitoring?.()
      stopMonitoring = null
    }

    return { status, pendingCount, conflicts, error, lastSyncedAt, refresh, flush, start, stop }
  })
}

export const useGoalsSyncStore = createGoalsSyncStoreDefinition()

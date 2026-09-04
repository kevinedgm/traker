<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAppStore }   from '@stores/app'
import { useAuthStore }  from '@stores/auth'
import { useHabitsStore } from '@stores/habits'
import { useCheckinsStore } from '@stores/checkins'
import { useRewardsStore } from '@stores/rewards'
import { useFlexibleGroupsStore } from '@stores/flexibleGroups'
import { useSettingsStore } from '@stores/settings'
import { useDayClosuresStore } from '@stores/dayClosures'
import { currentTimezone, localDateKey } from '@/features/habits/domain.js'
import { features } from '@/config/features.js'
import LockOverlay from '@components/lock/LockOverlay.vue'
import AppShell    from '@components/layout/AppShell.vue'
import RewardCelebrationHost from '@components/rewards/RewardCelebrationHost.vue'
import InAppNotificationHost from '@components/notifications/InAppNotificationHost.vue'
import ToastHost from '@components/layout/ToastHost.vue'
import { startScheduler, stopScheduler, getPermission, showNotification } from '@services/notifications.service'
import { isSupabaseConfigured } from '@services/supabase/config.js'
import * as sync from '@services/supabase/sync.service'
import { useToast } from '@/composables/useToast.js'
import {
  claimDueNotificationActions,
  completeNotificationAction,
  nextNotificationActionAt,
  releaseNotificationAction,
} from '@/features/notifications/actionQueue.js'

const appStore    = useAppStore()
const authStore   = useAuthStore()
const habitsStore = useHabitsStore()
const checkinsStore = useCheckinsStore()
const rewardsStore = useRewardsStore()
const flexibleGroupsStore = useFlexibleGroupsStore()
const settingsStore = useSettingsStore()
const dayClosuresStore = useDayClosuresStore()
const router = useRouter()
const toast = useToast()
let goalsSyncStore = null

// Apply theme before first paint (no FOUC)
appStore.initTheme()

// ── Supabase auth listener ─────────────────────────────────────────────────
let unsubAuth
let cloudIdleId
let cloudDisposed = false
let cloudPausedForDeletion = false
let pilotSyncTimer
let pilotSyncInFlight = null
let accountSyncInFlight = null
let pilotOwnerMismatch = false
let stopReconnectSync = null
let notificationActionTimer = null
let notificationActionDrain = null

function mergeCloudSnapshot(cloud, v2Changes = []) {
  if (cloud?.habits) habitsStore.mergeFromCloud(cloud.habits)
  if (cloud?.checkins) checkinsStore.mergeFromCloud(cloud.checkins)
  if (cloud?.rewards) rewardsStore.mergeFromCloud(cloud.rewards)
  if (cloud?.flexibleGroups) flexibleGroupsStore.mergeFromCloud(cloud.flexibleGroups)
  if (cloud?.dayClosures) dayClosuresStore.mergeFromCloud(cloud.dayClosures)
  if (v2Changes.length) habitsStore.applyV2Changes(v2Changes)
}

async function reconcilePilotV2() {
  if (!features.syncV2Pilot || !authStore.isCloudAuthenticated || cloudDisposed || cloudPausedForDeletion || pilotOwnerMismatch) return null
  if (pilotSyncInFlight) return pilotSyncInFlight
  pilotSyncInFlight = (async () => {
    const flushed = await sync.flushQueue()
    let page
    let pages = 0
    do {
      page = await sync.pullV2PilotChanges()
      pages += 1
    } while (page?.hasMore && pages < 5)
    const changes = page?.pendingChanges ?? []
    if (!changes.length
      && !page?.rehydrationRequired
      && !flushed?.pilot?.synced
      && !flushed?.legacyOperations) return null
    const cloud = await sync.pullAll()
    if (!cloud) return { snapshotPending: true, changes: changes.length }
    mergeCloudSnapshot(cloud, changes)
    await sync.acknowledgeV2PilotSnapshot()
    return { changes: changes.length, rehydrated: Boolean(page?.rehydrationRequired) }
  })().finally(() => {
    pilotSyncInFlight = null
  })
  return pilotSyncInFlight
}

function handlePilotVisibility() {
  if (document.visibilityState === 'visible') reconcilePilotV2().catch(console.warn)
}

function handlePilotFocus() {
  reconcilePilotV2().catch(console.warn)
}

async function ensureConfiguredPush() {
  if (cloudPausedForDeletion) return
  if (getPermission() !== 'granted') return
  if (features.syncV2Pilot && (!authStore.isCloudAuthenticated || pilotOwnerMismatch)) return
  const { ensurePushSubscription } = await import('@services/push.service')
  return ensurePushSubscription()
}

async function initializeGoalsSync() {
  if (!features.goals || !settingsStore.goalsSyncConsented) return null
  const [{ useGoalsSyncStore }, { saveGoalsConsent }] = await Promise.all([
    import('@stores/goalsSync'),
    import('@services/supabase/goals.service.js'),
  ])
  goalsSyncStore = useGoalsSyncStore()
  goalsSyncStore.start({ consentProvider: () => settingsStore.goalsSyncConsented })
  return { saveGoalsConsent }
}

async function initializeCloud() {
  if (!isSupabaseConfigured || cloudDisposed || cloudPausedForDeletion) return
  const [{ onAuthChange }, goals] = await Promise.all([
    import('@services/supabase/auth.service'),
    initializeGoalsSync(),
  ])
  if (cloudDisposed || cloudPausedForDeletion) return

  unsubAuth = onAuthChange(async (user) => {
    const previousUserId = authStore.cloudUser?.id ?? null
    authStore.setCloudUser(user)

    if (!user) {
      pilotOwnerMismatch = false
      return
    }

    if (cloudPausedForDeletion) return

    if (user.id !== previousUserId) {
      accountSyncInFlight = (async () => {
        if (features.syncV2Pilot) {
          const ownership = await sync.ensureV2PilotOwner(user.id)
          if (cloudPausedForDeletion) return
          pilotOwnerMismatch = !ownership.allowed
          if (pilotOwnerMismatch) {
            toast.show({
              message: 'Esta copia local pertenece a otra cuenta. La sincronización quedó pausada y no mezcló información.',
              tone: 'warning',
              actionLabel: 'Revisar',
              onAction: () => router.push('/settings'),
              durationMs: 0,
            })
            return
          }
        }
        await sync.flushQueue()
        if (cloudPausedForDeletion) return
        const pilotPage = features.syncV2Pilot ? await sync.pullV2PilotChanges() : null
        if (cloudPausedForDeletion) return
        const cloud = await sync.pullAll()
        if (!cloud || cloudPausedForDeletion) return
        mergeCloudSnapshot(cloud, pilotPage?.pendingChanges ?? [])
        if (features.syncV2Pilot) await sync.acknowledgeV2PilotSnapshot()
        if (goals?.saveGoalsConsent && goalsSyncStore) {
          await goals.saveGoalsConsent({
            purpose: 'goals_sync',
            consentVersion: settingsStore.goalsSyncConsentVersion,
            grantedAt: settingsStore.goalsSyncConsentGrantedAt,
          })
          if (cloudPausedForDeletion) return
          await goalsSyncStore.flush({ consented: true })
        }
        if (cloudPausedForDeletion) return
        // Goal links have same-user foreign keys, so goals reach the cloud
        // before the habit bundle that references them.
        await sync.pushAll(habitsStore.habits)
        if (cloudPausedForDeletion) return
        await sync.pushAllCheckins(checkinsStore.checkins)
        if (cloudPausedForDeletion) return
        await sync.pushAllRewards(rewardsStore.rewards, rewardsStore.claims)
        if (cloudPausedForDeletion) return
        await sync.pushAllFlexibleGroups(flexibleGroupsStore.groups)
        if (cloudPausedForDeletion) return
        await sync.pushAllDayClosures(dayClosuresStore.closures)
        if (cloudPausedForDeletion) return
        await sync.flushQueue()
        if (cloudPausedForDeletion) return
        await sync.pushSettings(settingsStore.$state)
        if (cloudPausedForDeletion) return
        await ensureConfiguredPush()
      })().catch(error => {
        if (!cloudPausedForDeletion) console.warn(error)
      }).finally(() => {
        accountSyncInFlight = null
      })
    } else if (features.syncV2Pilot && !pilotOwnerMismatch) {
      reconcilePilotV2().catch(console.warn)
    }
  })

  ensureConfiguredPush().catch(console.warn)
}

async function handleAccountDeletionPause(event) {
  if (event.detail) event.detail.handled = true
  cloudPausedForDeletion = true
  if (pilotSyncTimer) {
    window.clearInterval(pilotSyncTimer)
    pilotSyncTimer = null
  }
  clearTimeout(_settingsSyncTimer)
  stopReconnectSync?.()
  stopReconnectSync = null
  await Promise.allSettled([accountSyncInFlight, pilotSyncInFlight].filter(Boolean))
  event.detail?.resolve?.()
}

function handleAccountDeletionResume() {
  if (cloudDisposed || !cloudPausedForDeletion) return
  cloudPausedForDeletion = false
  if (!stopReconnectSync) stopReconnectSync = sync.startReconnectSync()
  if (features.syncV2Pilot && !pilotSyncTimer) {
    pilotSyncTimer = window.setInterval(() => reconcilePilotV2().catch(console.warn), 12_000)
  }
  reconcilePilotV2().catch(console.warn)
}

// ── Notification action buttons (done / snooze / skip) ─────────────────────
// The SW can't touch Pinia, so notificationclick posts a message here
// instead — see src/sw.js and HABIT_REMINDER_ACTIONS in notifications.service.js.
async function applyNotificationAction(data) {
  const habit = data.habitId ? habitsStore.habits.find(h => h.id === data.habitId) : null
  if (!habit) return
  const day = habitsStore.getCurrentDay(habit)
  const existingLog = habit.logs?.[day] ?? {}
  const preservedContext = {
    contextCodes: existingLog.contextCodes ?? [],
    emotion: existingLog.emotion ?? null,
    energy: existingLog.energy ?? null,
    note: existingLog.note ?? '',
  }

  if (data.action === 'done') {
    habitsStore.logDay(habit.id, day, { status: 'done', minimumUsed: false, ...preservedContext })
  } else if (data.action === 'skip') {
    habitsStore.logDay(habit.id, day, { status: 'not_done', minimumUsed: false, ...preservedContext })
  } else if (data.action === 'snooze') {
    await showNotification('Traker', {
      body: 'Tienes un recordatorio pendiente.',
      tag: `habit-${habit.id}`,
      renotify: true,
      data: { url: `/habit/${habit.id}`, habitId: habit.id },
    })
  }
}

async function drainNotificationActions() {
  if (notificationActionDrain) return notificationActionDrain
  notificationActionDrain = (async () => {
    window.clearTimeout(notificationActionTimer)
    const claimed = await claimDueNotificationActions()
    for (const action of claimed) {
      try {
        await applyNotificationAction(action)
        await completeNotificationAction(action.id)
      } catch (error) {
        await releaseNotificationAction(action.id)
        console.warn('[notification-action] retry preserved:', error?.message)
      }
    }
    const nextAt = await nextNotificationActionAt()
    if (nextAt !== null) {
      notificationActionTimer = window.setTimeout(
        () => drainNotificationActions().catch(console.warn),
        Math.min(Math.max(0, nextAt - Date.now()), 2_147_000_000),
      )
    }
  })().finally(() => { notificationActionDrain = null })
  return notificationActionDrain
}

function handleServiceWorkerMessage(event) {
  if (event.data?.type === 'NOTIFICATION_ACTION_QUEUED') drainNotificationActions().catch(console.warn)
}

onMounted(() => {
  // A persisted queue must reconnect even when this app instance has not
  // produced a new mutation yet (for example, immediately after a reload).
  stopReconnectSync = sync.startReconnectSync()

  // ── Notification scheduler ───────────────────────────────────────────────
  // Start immediately if permission is already granted.
  // If the user grants permission later (via Settings), the composable
  // in SettingsPage calls startScheduler() at that point.
  if (getPermission() === 'granted') {
    startScheduler(
      () => habitsStore.habits.filter(habit => !flexibleGroupsStore.activeMemberIds.has(habit.id)),
      () => settingsStore.$state,
      () => {
        const timezone = currentTimezone()
        return { timezone, dayClosure: dayClosuresStore.forDate(localDateKey(new Date(), timezone)) }
      },
    )
  }

  navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)
  drainNotificationActions().catch(console.warn)
  window.addEventListener('traker:account-deletion-pause', handleAccountDeletionPause)
  window.addEventListener('traker:account-deletion-resume', handleAccountDeletionResume)
  if (features.syncV2Pilot) {
    window.addEventListener('focus', handlePilotFocus)
    document.addEventListener('visibilitychange', handlePilotVisibility)
    pilotSyncTimer = window.setInterval(() => reconcilePilotV2().catch(console.warn), 12_000)
  }

  const hasAuthCallback = window.location.search.includes('code=') || window.location.hash.includes('access_token')
  if (hasAuthCallback || !('requestIdleCallback' in window)) initializeCloud().catch(console.warn)
  else cloudIdleId = window.requestIdleCallback(() => initializeCloud().catch(console.warn), { timeout: 1200 })
})

// Keep the cron's copy of the reminder prefs fresh (debounced)
let _settingsSyncTimer = null
watch(
  () => [
    settingsStore.notificationsEnabled,
    settingsStore.morningReminderEnabled,
    settingsStore.morningReminderTime,
    settingsStore.habitRemindersEnabled,
    settingsStore.closingReminderEnabled,
    settingsStore.closingReminderTime,
    settingsStore.returnReminderEnabled,
    settingsStore.notificationQuietStart,
    settingsStore.notificationQuietEnd,
    settingsStore.notificationDailyBudget,
    settingsStore.notificationSilencedUntil,
    settingsStore.lockScreenPrivacy,
    settingsStore.notificationDirectActionsEnabled,
    settingsStore.inactivityReminderEnabled,
    settingsStore.inactivityReminderTime,
    settingsStore.tone,
  ],
  () => {
    clearTimeout(_settingsSyncTimer)
    _settingsSyncTimer = setTimeout(() => {
      if (!isSupabaseConfigured || cloudPausedForDeletion) return
      sync.pushSettings(settingsStore.$state).catch(console.warn)
    }, 1500)
  }
)

onUnmounted(() => {
  cloudDisposed = true
  if (cloudIdleId) window.cancelIdleCallback?.(cloudIdleId)
  if (pilotSyncTimer) window.clearInterval(pilotSyncTimer)
  clearTimeout(_settingsSyncTimer)
  window.clearTimeout(notificationActionTimer)
  unsubAuth?.()
  stopScheduler()
  goalsSyncStore?.stop()
  stopReconnectSync?.()
  navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
  window.removeEventListener('traker:account-deletion-pause', handleAccountDeletionPause)
  window.removeEventListener('traker:account-deletion-resume', handleAccountDeletionResume)
  window.removeEventListener('focus', handlePilotFocus)
  document.removeEventListener('visibilitychange', handlePilotVisibility)
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <RewardCelebrationHost />
  <InAppNotificationHost />
  <ToastHost />

  <!-- Lock overlay — sits above everything; removed via Transition on auth.open() -->
  <Teleport to="body">
    <Transition name="lock">
      <LockOverlay v-if="authStore.isLocked" />
    </Transition>
  </Teleport>
</template>

<style>
/* ── Unlock reveal animation (iOS-style swipe up) ────────────────── */
.lock-leave-active {
  transition:
    transform 0.58s cubic-bezier(0.32, 0.72, 0, 1),
    opacity   0.48s ease;
  position: fixed;
  inset: 0;
  z-index: 999;
}
.lock-leave-to {
  transform: translateY(-100%);
  opacity: 0.15;
}
@media (prefers-reduced-motion: reduce) {
  .lock-leave-active {
    transition-duration: 1ms;
  }
  .lock-leave-to {
    transform: none;
    opacity: 0;
  }
}
</style>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useAppStore }   from '@stores/app'
import { useAuthStore }  from '@stores/auth'
import { useHabitsStore } from '@stores/habits'
import { useSettingsStore } from '@stores/settings'
import LockOverlay from '@components/lock/LockOverlay.vue'
import AppShell    from '@components/layout/AppShell.vue'
import { onAuthChange }  from '@services/supabase/auth.service'
import { flushQueue, pullAll, pushAll, pushSettings } from '@services/supabase/sync.service'
import { startScheduler, stopScheduler, getPermission } from '@services/notifications.service'
import { ensurePushSubscription } from '@services/push.service'

const appStore    = useAppStore()
const authStore   = useAuthStore()
const habitsStore = useHabitsStore()
const settingsStore = useSettingsStore()

// Apply theme before first paint (no FOUC)
appStore.initTheme()

// ── Supabase auth listener ─────────────────────────────────────────────────
let unsubAuth

onMounted(() => {
  unsubAuth = onAuthChange(async (user) => {
    const wasSignedIn = authStore.isCloudAuthenticated
    authStore.setCloudUser(user)

    if (user && !wasSignedIn) {
      ;(async () => {
        await flushQueue()
        const cloud = await pullAll()
        if (cloud?.habits) habitsStore.mergeFromCloud(cloud.habits)
        await pushAll(habitsStore.habits)
        // Cloud reminders: register this device + sync reminder prefs
        await pushSettings(settingsStore.$state)
        await ensurePushSubscription()
      })().catch(console.warn)
    }
  })

  // ── Notification scheduler ───────────────────────────────────────────────
  // Start immediately if permission is already granted.
  // If the user grants permission later (via Settings), the composable
  // in SettingsPage calls startScheduler() at that point.
  if (getPermission() === 'granted') {
    startScheduler(() => habitsStore.habits, () => settingsStore.$state)
  }

  // ── Web Push ─────────────────────────────────────────────────────────────
  // Self-heals on every app start: re-upserts the current endpoint
  // (covers browser-rotated subscriptions) and no-ops when permission
  // or session are missing.
  ensurePushSubscription().catch(console.warn)
})

// Keep the cron's copy of the reminder prefs fresh (debounced)
let _settingsSyncTimer = null
watch(
  () => [
    settingsStore.notificationsEnabled,
    settingsStore.morningReminderEnabled,
    settingsStore.morningReminderTime,
    settingsStore.inactivityReminderEnabled,
    settingsStore.inactivityReminderTime,
  ],
  () => {
    clearTimeout(_settingsSyncTimer)
    _settingsSyncTimer = setTimeout(() => {
      pushSettings(settingsStore.$state).catch(console.warn)
    }, 1500)
  }
)

onUnmounted(() => {
  unsubAuth?.()
  stopScheduler()
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>

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
</style>

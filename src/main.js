import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'

import { storage } from '@services/storage'
import { createPersistence } from '@plugins/persistence'
import { features } from '@/config/features.js'
import App from './App.vue'
import CompatibilityGate from '@/components/system/CompatibilityGate.vue'
import router from './router'
import './assets/main.css'
import './assets/aurora.css'

// ─────────────────────────────────────────────────────────────
// 1. Apply theme BEFORE anything renders (prevents FOUC)
// ─────────────────────────────────────────────────────────────
//
// We read the stored theme directly from storage here —
// before Pinia / Vue is initialised — so the correct
// class is on <html> from the very first paint.
;(function applyThemeEarly() {
  try {
    const appState = storage.read(storage.KEYS.APP, {})
    const theme    = appState?.theme ?? 'system'
    const isDark   =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark',  isDark)
    document.documentElement.classList.toggle('light', !isDark)
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  } catch {
    // Non-blocking: worst case the theme flashes on first load
  }
})()

// ─────────────────────────────────────────────────────────────
// 2. Run schema migrations + stamp the meta record
// ─────────────────────────────────────────────────────────────
const bootstrap = storage.bootstrap()

if (bootstrap.status === 'blocked_newer_schema') {
  let registration = null
  registerSW({
    immediate: true,
    onRegisteredSW(_url, currentRegistration) {
      registration = currentRegistration ?? null
      registration?.update().catch(error => console.warn('[pwa] update check failed:', error))
    },
  })

  const gate = createApp(CompatibilityGate, {
    storedVersion: bootstrap.fromVersion,
    supportedVersion: bootstrap.supportedVersion,
    onRefresh: async () => {
      try {
        await registration?.update()
      } catch (error) {
        console.warn('[pwa] manual update check failed:', error)
      } finally {
        window.location.reload()
      }
    },
  })
  gate.mount('#app')
} else {
  if (features.syncV2Pilot) {
    import('@/services/local/v2.migration.js')
      .then(({ backfillLocalV2 }) => backfillLocalV2({ includeGoals: features.goals }))
      .catch(error => console.warn('[v2 pilot] local backfill failed; legacy reader remains active:', error))
  }

  // Register the service worker so notifications can use it.
  registerSW({ immediate: true })

  const pinia = createPinia()
  pinia.use(createPersistence())

  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  app.mount('#app')
}

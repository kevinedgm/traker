import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { storage } from '@services/storage'
import { createPersistence } from '@plugins/persistence'
import App from './App.vue'
import router from './router'
import './assets/main.css'

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
  } catch {
    // Non-blocking: worst case the theme flashes on first load
  }
})()

// ─────────────────────────────────────────────────────────────
// 2. Run schema migrations + stamp the meta record
// ─────────────────────────────────────────────────────────────
storage.bootstrap()

// ─────────────────────────────────────────────────────────────
// 3. Create Pinia with the persistence plugin
// ─────────────────────────────────────────────────────────────
const pinia = createPinia()
pinia.use(createPersistence())

// ─────────────────────────────────────────────────────────────
// 4. Mount the Vue app
// ─────────────────────────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

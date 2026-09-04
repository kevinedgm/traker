/**
 * @file app.js
 * Pinia store — runtime UI state.
 *
 * `theme` is persisted via the persistence plugin.
 * `sidebarOpen` is ephemeral (session-only).
 *
 * The `applyTheme()` / `initTheme()` functions handle the DOM
 * class toggle and the system-preference media-query listener.
 * main.js calls storage directly to apply the theme BEFORE
 * the Vue app mounts (prevents flash of wrong theme).
 *
 * Toast notifications are handled by src/composables/useToast.js +
 * ToastHost.vue, not by this store.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore(
  'app',

  () => {
    // ── State ──────────────────────────────────────────────────
    // Starts with 'system'; plugin hydrates the saved preference.
    const theme         = ref('system')
    const sidebarOpen   = ref(true)        // not persisted

    // ── Computed ───────────────────────────────────────────────
    const isDark = computed(() => {
      if (theme.value === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      return theme.value === 'dark'
    })

    // ── Theme actions ──────────────────────────────────────────

    function applyTheme() {
      const dark = isDark.value
      document.documentElement.classList.toggle('dark',  dark)
      document.documentElement.classList.toggle('light', !dark)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }

    /**
     * Called once in App.vue after the store is available.
     * The plugin has already hydrated `theme` by this point, so
     * we just apply it to the DOM and wire up the system listener.
     */
    function initTheme() {
      applyTheme()
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (theme.value === 'system') applyTheme()
        })
    }

    function setTheme(value) {
      theme.value = value
      applyTheme()
      // Plugin writes to localStorage automatically via $subscribe
    }

    function toggleTheme() {
      setTheme(isDark.value ? 'light' : 'dark')
    }

    // ── Sidebar ────────────────────────────────────────────────
    function toggleSidebar() {
      sidebarOpen.value = !sidebarOpen.value
    }

    return {
      theme,
      isDark,
      sidebarOpen,
      initTheme,
      setTheme,
      toggleTheme,
      toggleSidebar,
    }
  },

  // ── Persistence config ─────────────────────────────────────────
  {
    persist: {
      key:  'traker:app',
      // Only persist theme. sidebarOpen is ephemeral.
      pick: ['theme'],

      serialize(state) {
        return { theme: state.theme }
      },

      deserialize(saved) {
        const valid = ['light', 'dark', 'system']
        const theme = valid.includes(saved?.theme) ? saved.theme : 'system'
        return { theme }
      },
    },
  }
)

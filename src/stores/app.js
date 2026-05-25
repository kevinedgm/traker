/**
 * @file app.js
 * Pinia store — runtime UI state.
 *
 * `theme` is persisted via the persistence plugin.
 * `notifications` and `sidebarOpen` are ephemeral (session-only).
 *
 * The `applyTheme()` / `initTheme()` functions handle the DOM
 * class toggle and the system-preference media-query listener.
 * main.js calls storage directly to apply the theme BEFORE
 * the Vue app mounts (prevents flash of wrong theme).
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
    const notifications = ref([])          // not persisted

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

    // ── Toast notifications ────────────────────────────────────
    function addNotification({ type = 'info', message, duration = 4000 }) {
      const id = Date.now()
      notifications.value.push({ id, type, message })
      if (duration > 0) setTimeout(() => removeNotification(id), duration)
      return id
    }

    function removeNotification(id) {
      notifications.value = notifications.value.filter(n => n.id !== id)
    }

    return {
      theme,
      isDark,
      sidebarOpen,
      notifications,
      initTheme,
      setTheme,
      toggleTheme,
      toggleSidebar,
      addNotification,
      removeNotification,
    }
  },

  // ── Persistence config ─────────────────────────────────────────
  {
    persist: {
      key:  'traker:app',
      // Only persist theme. sidebarOpen & notifications are ephemeral.
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

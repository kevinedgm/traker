/**
 * @file settings.js
 * Pinia store — user preferences.
 *
 * All fields are persisted via the persistence plugin.
 * This store is the single source of truth for every user-facing
 * configuration that survives sessions.
 *
 * Consuming components should import this store and read/write
 * settings here rather than touching localStorage directly.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore(
  'settings',

  () => {
    // ── Identity ───────────────────────────────────────────────
    /** Display name shown in the dashboard greeting. */
    const displayName = ref('')

    // ── Notifications ──────────────────────────────────────────
    /** Whether the user has opted in to habit reminders. */
    const notificationsEnabled = ref(false)

    /** Default reminder time used when creating a new habit. */
    const defaultReminderTime  = ref('08:00')

    // ── Display ────────────────────────────────────────────────
    /** Legacy key for the optional continuity indicator. */
    const showStreak           = ref(true)

    /** Show "X completed" count in the grid footer. */
    const showProgress         = ref(true)

    /** Use a denser cell size on the day grid (future option). */
    const compactGrid          = ref(false)

    // ── Security ───────────────────────────────────────────────
    /**
     * Re-lock the app when it goes to the background.
     * Requires PIN to be set (auth store) to have any effect.
     */
    const requirePinOnResume   = ref(false)

    /**
     * Minutes of inactivity before the app auto-locks.
     * 0 = disabled.
     */
    const autoLockMinutes      = ref(0)

    // ── Data ───────────────────────────────────────────────────
    /** Whether to include emotional data in exports. */
    const includeEmotionsInExport = ref(true)

    // ── ADHD-First / Phase 2 scaffold ──────────────────────────
    // Reserved for future features — persisted now to avoid migration pain.

    /**
     * Flexible days are now stored as log level 4.
     * They preserve continuity without adding progress.
     */
    const flexibleModeEnabled   = ref(false)

    /**
     * Energy tracking: daily energy rating (1–5) alongside habit log.
     * Phase 2: energy slider added to LogModal.
     * Phase 3: used in insights correlation engine.
     */
    const energyTrackingEnabled = ref(false)

    // ── Computed helpers ───────────────────────────────────────

    /** True if the auto-lock feature is active. */
    const autoLockEnabled = computed(
      () => requirePinOnResume.value || autoLockMinutes.value > 0
    )

    // ── Actions ────────────────────────────────────────────────

    function resetToDefaults() {
      displayName.value           = ''
      notificationsEnabled.value  = false
      defaultReminderTime.value   = '08:00'
      showStreak.value            = true
      showProgress.value          = true
      compactGrid.value           = false
      requirePinOnResume.value    = false
      autoLockMinutes.value       = 0
      includeEmotionsInExport.value = true
      flexibleModeEnabled.value     = false
      energyTrackingEnabled.value   = false
    }

    return {
      // Identity
      displayName,
      // Notification
      notificationsEnabled,
      defaultReminderTime,
      // Display
      showStreak,
      showProgress,
      compactGrid,
      // Security
      requirePinOnResume,
      autoLockMinutes,
      autoLockEnabled,
      // Data
      includeEmotionsInExport,
      // ADHD-First scaffold (Phase 2+)
      flexibleModeEnabled,
      energyTrackingEnabled,
      // Actions
      resetToDefaults,
    }
  },

  // ── Persistence config ─────────────────────────────────────────
  {
    persist: {
      key: 'traker:settings',
      // Persist all state (no `pick` needed — nothing is ephemeral)

      serialize(state) {
        return {
          displayName:             state.displayName,
          notificationsEnabled:    state.notificationsEnabled,
          defaultReminderTime:     state.defaultReminderTime,
          showStreak:              state.showStreak,
          showProgress:            state.showProgress,
          compactGrid:             state.compactGrid,
          requirePinOnResume:      state.requirePinOnResume,
          autoLockMinutes:         state.autoLockMinutes,
          includeEmotionsInExport: state.includeEmotionsInExport,
          flexibleModeEnabled:     state.flexibleModeEnabled,
          energyTrackingEnabled:   state.energyTrackingEnabled,
        }
      },

      deserialize(saved) {
        if (!saved || typeof saved !== 'object') return {}
        return {
          displayName:             String (saved.displayName             ?? ''),
          notificationsEnabled:    Boolean(saved.notificationsEnabled    ?? false),
          defaultReminderTime:     String (saved.defaultReminderTime     ?? '08:00'),
          showStreak:              Boolean(saved.showStreak              ?? true),
          showProgress:            Boolean(saved.showProgress            ?? true),
          compactGrid:             Boolean(saved.compactGrid             ?? false),
          requirePinOnResume:      Boolean(saved.requirePinOnResume      ?? false),
          autoLockMinutes:         Number (saved.autoLockMinutes         ?? 0),
          includeEmotionsInExport: Boolean(saved.includeEmotionsInExport ?? true),
          flexibleModeEnabled:     Boolean(saved.flexibleModeEnabled     ?? false),
          energyTrackingEnabled:   Boolean(saved.energyTrackingEnabled   ?? false),
        }
      },

      // Debounce writes since settings change from UI sliders/toggles
      // that may fire rapidly.
      debounce: 200,
    },
  }
)

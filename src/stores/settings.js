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

    /** Daily fallback reminder when nothing has been logged yet. */
    const inactivityReminderEnabled = ref(true)

    /** Time for the fallback "nothing logged yet" reminder. */
    const inactivityReminderTime    = ref('20:00')

    /** Morning motivational reminder. */
    const morningReminderEnabled    = ref(true)

    /** Time for the morning motivational reminder. */
    const morningReminderTime       = ref('08:00')

    /** Group reminders for scheduled habits instead of one alert per habit. */
    const habitRemindersEnabled     = ref(true)

    /** Gentle prompt to explicitly close the day. */
    const closingReminderEnabled    = ref(true)
    const closingReminderTime       = ref('20:00')

    /** Low-frequency invitation after several inactive days. */
    const returnReminderEnabled     = ref(true)

    /** Overnight window where no notification may be planned. */
    const notificationQuietStart    = ref('21:30')
    const notificationQuietEnd      = ref('07:30')

    /** Hard cap for actual reminders shown on this device per local day. */
    const notificationDailyBudget   = ref(2)

    /** ISO timestamp used by the explicit “silence today” control. */
    const notificationSilencedUntil = ref(null)

    /** Notification copy is generic on the lock screen by default. */
    const lockScreenPrivacy         = ref('generic')

    /** Direct lock-screen actions remain off until explicitly approved. */
    const notificationDirectActionsEnabled = ref(false)

    // ── Display ────────────────────────────────────────────────
    /** Legacy key for the optional continuity indicator. */
    const showStreak           = ref(true)

    /** Show "X completed" count in the grid footer. */
    const showProgress         = ref(true)

    /** Use a denser cell size on the day grid (future option). */
    const compactGrid          = ref(false)

    /** Maximum number of active goals intentionally kept in the focus shortlist. */
    const goalsFocusLimit      = ref(1)

    // ── Goals privacy consent ──────────────────────────────────
    const goalsSyncConsentVersion = ref(null)
    const goalsSyncConsentGrantedAt = ref(null)
    const goalsAnalyticsConsentVersion = ref(null)
    const goalsAnalyticsConsentGrantedAt = ref(null)

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

    /** Whether the optional daily check-in invitation should remain visible. */
    const dailyCheckinPrompt = ref('ask')

    // ── Personality / copy system ────────────────────────────────
    /**
     * Global tone for Traker's copy engine: 'normal' | 'trusted' | 'no_respect'.
     * Default is 'no_respect' per product decision — heavy Mexican carrilla
     * is the default voice; users opt DOWN into calmer tones, not up.
     * See src/features/copy/ for the engine and catalog.
     */
    const tone = ref('no_respect')

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
    const goalsSyncConsented = computed(() => goalsSyncConsentVersion.value !== null)
    const goalsAnalyticsConsented = computed(() => goalsAnalyticsConsentVersion.value !== null)

    // ── Actions ────────────────────────────────────────────────

    function resetToDefaults() {
      displayName.value           = ''
      notificationsEnabled.value  = false
      defaultReminderTime.value   = '08:00'
      inactivityReminderEnabled.value = true
      inactivityReminderTime.value    = '20:00'
      morningReminderEnabled.value    = true
      morningReminderTime.value       = '08:00'
      habitRemindersEnabled.value     = true
      closingReminderEnabled.value    = true
      closingReminderTime.value       = '20:00'
      returnReminderEnabled.value     = true
      notificationQuietStart.value    = '21:30'
      notificationQuietEnd.value      = '07:30'
      notificationDailyBudget.value   = 2
      notificationSilencedUntil.value = null
      lockScreenPrivacy.value         = 'generic'
      notificationDirectActionsEnabled.value = false
      showStreak.value            = true
      showProgress.value          = true
      compactGrid.value           = false
      goalsFocusLimit.value       = 1
      goalsSyncConsentVersion.value = null
      goalsSyncConsentGrantedAt.value = null
      goalsAnalyticsConsentVersion.value = null
      goalsAnalyticsConsentGrantedAt.value = null
      requirePinOnResume.value    = false
      autoLockMinutes.value       = 0
      includeEmotionsInExport.value = true
      dailyCheckinPrompt.value      = 'ask'
      tone.value                  = 'no_respect'
      flexibleModeEnabled.value     = false
      energyTrackingEnabled.value   = false
    }

    function grantGoalsSyncConsent(version = 'goals-sync-v1') {
      goalsSyncConsentVersion.value = version
      goalsSyncConsentGrantedAt.value = new Date().toISOString()
    }

    function revokeGoalsSyncConsent() {
      goalsSyncConsentVersion.value = null
      goalsSyncConsentGrantedAt.value = null
    }

    function grantGoalsAnalyticsConsent(version = 'goals-analytics-v1') {
      goalsAnalyticsConsentVersion.value = version
      goalsAnalyticsConsentGrantedAt.value = new Date().toISOString()
    }

    function revokeGoalsAnalyticsConsent() {
      goalsAnalyticsConsentVersion.value = null
      goalsAnalyticsConsentGrantedAt.value = null
    }

    function silenceNotificationsForToday(now = new Date()) {
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)
      notificationSilencedUntil.value = endOfDay.toISOString()
    }

    function clearNotificationSilence() {
      notificationSilencedUntil.value = null
    }

    return {
      // Identity
      displayName,
      // Notification
      notificationsEnabled,
      defaultReminderTime,
      inactivityReminderEnabled,
      inactivityReminderTime,
      morningReminderEnabled,
      morningReminderTime,
      habitRemindersEnabled,
      closingReminderEnabled,
      closingReminderTime,
      returnReminderEnabled,
      notificationQuietStart,
      notificationQuietEnd,
      notificationDailyBudget,
      notificationSilencedUntil,
      lockScreenPrivacy,
      notificationDirectActionsEnabled,
      // Display
      showStreak,
      showProgress,
      compactGrid,
      goalsFocusLimit,
      goalsSyncConsentVersion,
      goalsSyncConsentGrantedAt,
      goalsAnalyticsConsentVersion,
      goalsAnalyticsConsentGrantedAt,
      goalsSyncConsented,
      goalsAnalyticsConsented,
      // Security
      requirePinOnResume,
      autoLockMinutes,
      autoLockEnabled,
      // Data
      includeEmotionsInExport,
      dailyCheckinPrompt,
      // Personality / copy system
      tone,
      // ADHD-First scaffold (Phase 2+)
      flexibleModeEnabled,
      energyTrackingEnabled,
      // Actions
      resetToDefaults,
      grantGoalsSyncConsent,
      revokeGoalsSyncConsent,
      grantGoalsAnalyticsConsent,
      revokeGoalsAnalyticsConsent,
      silenceNotificationsForToday,
      clearNotificationSilence,
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
          inactivityReminderEnabled: state.inactivityReminderEnabled,
          inactivityReminderTime:    state.inactivityReminderTime,
          morningReminderEnabled:    state.morningReminderEnabled,
          morningReminderTime:       state.morningReminderTime,
          habitRemindersEnabled:     state.habitRemindersEnabled,
          closingReminderEnabled:    state.closingReminderEnabled,
          closingReminderTime:       state.closingReminderTime,
          returnReminderEnabled:     state.returnReminderEnabled,
          notificationQuietStart:    state.notificationQuietStart,
          notificationQuietEnd:      state.notificationQuietEnd,
          notificationDailyBudget:   state.notificationDailyBudget,
          notificationSilencedUntil: state.notificationSilencedUntil,
          lockScreenPrivacy:         state.lockScreenPrivacy,
          notificationDirectActionsEnabled: state.notificationDirectActionsEnabled,
          showStreak:              state.showStreak,
          showProgress:            state.showProgress,
          compactGrid:             state.compactGrid,
          goalsFocusLimit:         state.goalsFocusLimit,
          goalsSyncConsentVersion: state.goalsSyncConsentVersion,
          goalsSyncConsentGrantedAt: state.goalsSyncConsentGrantedAt,
          goalsAnalyticsConsentVersion: state.goalsAnalyticsConsentVersion,
          goalsAnalyticsConsentGrantedAt: state.goalsAnalyticsConsentGrantedAt,
          requirePinOnResume:      state.requirePinOnResume,
          autoLockMinutes:         state.autoLockMinutes,
          includeEmotionsInExport: state.includeEmotionsInExport,
          dailyCheckinPrompt:      state.dailyCheckinPrompt,
          tone:                    state.tone,
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
          inactivityReminderEnabled: Boolean(saved.inactivityReminderEnabled ?? true),
          inactivityReminderTime:    String (saved.inactivityReminderTime    ?? '20:00'),
          morningReminderEnabled:    Boolean(saved.morningReminderEnabled    ?? true),
          morningReminderTime:       String (saved.morningReminderTime       ?? '08:00'),
          habitRemindersEnabled:     Boolean(saved.habitRemindersEnabled     ?? true),
          closingReminderEnabled:    Boolean(saved.closingReminderEnabled    ?? saved.inactivityReminderEnabled ?? true),
          closingReminderTime:       String (saved.closingReminderTime       ?? saved.inactivityReminderTime ?? '20:00'),
          returnReminderEnabled:     Boolean(saved.returnReminderEnabled     ?? true),
          notificationQuietStart:    String (saved.notificationQuietStart    ?? '21:30'),
          notificationQuietEnd:      String (saved.notificationQuietEnd      ?? '07:30'),
          notificationDailyBudget:   Math.min(6, Math.max(0, Number(saved.notificationDailyBudget ?? 2))),
          notificationSilencedUntil: saved.notificationSilencedUntil ? String(saved.notificationSilencedUntil) : null,
          lockScreenPrivacy:         saved.lockScreenPrivacy === 'names_allowed' ? 'names_allowed' : 'generic',
          notificationDirectActionsEnabled: Boolean(saved.notificationDirectActionsEnabled ?? false),
          showStreak:              Boolean(saved.showStreak              ?? true),
          showProgress:            Boolean(saved.showProgress            ?? true),
          compactGrid:             Boolean(saved.compactGrid             ?? false),
          goalsFocusLimit:         Math.min(3, Math.max(1, Number(saved.goalsFocusLimit ?? 1))),
          goalsSyncConsentVersion: saved.goalsSyncConsentVersion ? String(saved.goalsSyncConsentVersion) : null,
          goalsSyncConsentGrantedAt: saved.goalsSyncConsentGrantedAt ? String(saved.goalsSyncConsentGrantedAt) : null,
          goalsAnalyticsConsentVersion: saved.goalsAnalyticsConsentVersion ? String(saved.goalsAnalyticsConsentVersion) : null,
          goalsAnalyticsConsentGrantedAt: saved.goalsAnalyticsConsentGrantedAt ? String(saved.goalsAnalyticsConsentGrantedAt) : null,
          requirePinOnResume:      Boolean(saved.requirePinOnResume      ?? false),
          autoLockMinutes:         Number (saved.autoLockMinutes         ?? 0),
          includeEmotionsInExport: Boolean(saved.includeEmotionsInExport ?? true),
          dailyCheckinPrompt:      saved.dailyCheckinPrompt === 'never' ? 'never' : 'ask',
          tone:                    ['normal', 'trusted', 'no_respect'].includes(saved.tone) ? saved.tone : 'no_respect',
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

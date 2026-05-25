/**
 * @file auth.js
 * Pinia store — PIN authentication.
 *
 * `pin` is persisted via the persistence plugin.
 * `isLocked` is intentionally NOT persisted — the app always
 *  starts in a locked state and requires a fresh unlock.
 *
 * PIN is stored as a raw string (e.g. "1234").
 * Backward compat: old format was bare string in localStorage;
 * the custom deserializer handles both representations.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore(
  'auth',

  () => {
    // ── State ──────────────────────────────────────────────────
    // Starts null; plugin hydrates from storage if a PIN exists.
    const pin      = ref(null)
    // Always starts locked — we never persist the lock state.
    const isLocked = ref(true)
    // Supabase user — populated by App.vue's onAuthChange listener.
    // NOT persisted (session is managed by Supabase SDK in localStorage).
    const cloudUser = ref(null)

    // ── Computed ───────────────────────────────────────────────
    const hasPin               = computed(() => !!pin.value)
    const isAuthenticated      = computed(() => !isLocked.value)
    const isCloudAuthenticated = computed(() => cloudUser.value !== null)

    // ── Actions ────────────────────────────────────────────────

    /** Save a new PIN. Does NOT unlock the session. */
    function setPin(newPin) {
      pin.value = newPin
    }

    /**
     * Compare an attempt against the stored PIN.
     * Pure function — never mutates state.
     */
    function checkPin(attempt) {
      return attempt === pin.value
    }

    /**
     * Unlock the session. Called AFTER the success animation
     * plays in LockOverlay so the overlay transition looks good.
     */
    function open() {
      isLocked.value = false
    }

    /** Lock the session (e.g. after a background timeout). */
    function lock() {
      isLocked.value = true
    }

    /** Remove the PIN entirely and lock. */
    function resetPin() {
      pin.value      = null
      isLocked.value = true
    }

    /** Set the Supabase user. Called from App.vue's onAuthChange. */
    function setCloudUser(user) {
      cloudUser.value = user ?? null
    }

    return {
      pin,
      isLocked,
      cloudUser,
      hasPin,
      isAuthenticated,
      isCloudAuthenticated,
      setPin,
      checkPin,
      open,
      lock,
      resetPin,
      setCloudUser,
    }
  },

  // ── Persistence config ─────────────────────────────────────────
  {
    persist: {
      key:  'traker:pin',
      pick: ['pin'],    // isLocked is NOT in pick → never persisted

      /**
       * Serialize: store just the raw PIN string (or null).
       * Wrapping in an object lets the plugin's standard
       * JSON.stringify / JSON.parse flow handle it cleanly.
       */
      serialize(state) {
        return { pin: state.pin ?? null }
      },

      /**
       * Deserialize: handle three legacy formats:
       *   - null / undefined  → no PIN
       *   - number  (e.g. 1234)  → old JSON.parse of bare "1234"
       *   - string  (e.g. "1234") → raw string stored pre-plugin
       *   - object  { pin: "1234" } → current format
       */
      deserialize(saved) {
        if (!saved && saved !== 0) return { pin: null }

        if (typeof saved === 'object' && !Array.isArray(saved)) {
          return { pin: saved.pin != null ? String(saved.pin) : null }
        }

        // Legacy: bare string or number
        return { pin: String(saved) }
      },
    },
  }
)

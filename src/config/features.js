import { isLocalSupabaseUrl } from '@/services/supabase/config.js'

/**
 * Runtime-safe feature switches. A disabled feature must not initialise its
 * storage, register routes, or change existing Habit behaviour.
 */
export const features = Object.freeze({
  goals: import.meta.env.VITE_GOALS_ENABLED === 'true',
  // Phase 5 pilot. Off by default: the current localStorage/goal readers stay
  // authoritative and become the instant rollback path.
  syncV2Pilot: import.meta.env.VITE_SYNC_V2_PILOT === 'true'
    && isLocalSupabaseUrl(import.meta.env.VITE_SUPABASE_URL),
  // Copy/personality system — on by default (unlike `goals`, which is
  // opt-in). Lets us kill the whole thing in production without a
  // revert if some phrase/interpolation edge case misbehaves.
  copyPersonality: import.meta.env.VITE_COPY_PERSONALITY !== 'false',
})

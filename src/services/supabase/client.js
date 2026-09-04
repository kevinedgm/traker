/**
 * @file supabase/client.js
 *
 * Single Supabase client instance for the entire app.
 *
 * If VITE_SUPABASE_URL and a public key are not set,
 * `supabase` is null and every service gracefully no-ops —
 * the app keeps working with localStorage only (offline mode).
 */

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { KEYS } from '@/services/storage.js'
import { createTimedFetch, DEFAULT_REQUEST_TIMEOUT_MS } from './timedFetch.js'

const configuredTimeout = Number(import.meta.env.VITE_SUPABASE_REQUEST_TIMEOUT_MS)
export const SUPABASE_REQUEST_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : DEFAULT_REQUEST_TIMEOUT_MS

const timedFetch = typeof globalThis.fetch === 'function'
  ? createTimedFetch(globalThis.fetch.bind(globalThis), { timeoutMs: SUPABASE_REQUEST_TIMEOUT_MS })
  : undefined

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
        storageKey:         KEYS.SUPABASE_SESSION,
      },
      global: timedFetch ? { fetch: timedFetch } : undefined,
    })
  : null

export const isSupabaseEnabled = supabase !== null

if (isSupabaseEnabled) {
  console.info('[supabase] Client initialized ✓')
} else {
  console.info('[supabase] No credentials — offline-only mode')
}

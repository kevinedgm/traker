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

const URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ''

export const supabase = (URL && KEY)
  ? createClient(URL, KEY, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
        storageKey:         'traker:supabase-session',
      },
    })
  : null

export const isSupabaseEnabled = supabase !== null

if (isSupabaseEnabled) {
  console.info('[supabase] Client initialized ✓')
} else {
  console.info('[supabase] No credentials — offline-only mode')
}

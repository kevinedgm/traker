/**
 * @file supabase/auth.service.js
 *
 * Supabase authentication — email/password or magic link.
 *
 * Design:
 *  - All methods return { data, error } (Supabase SDK convention)
 *  - Methods are no-ops (return null) when Supabase isn't configured
 *  - The local PIN flow (LockOverlay) is INDEPENDENT of this —
 *    the PIN locks the app UI, Supabase auth provides the account identity
 *
 * User lifecycle:
 *   Anonymous use   → no Supabase account, data stays in localStorage
 *   Sign up         → Supabase account created, data starts syncing
 *   Sign in         → existing account, pulls down cloud data
 *   Sign out        → session cleared, app reverts to local-only mode
 */

import { supabase } from './client.js'

/**
 * Absolute URL email links should return to.
 * Includes the Vite base path so it resolves to the app on GitHub Pages
 * (https://user.github.io/traker/) — origin alone drops the /traker/ subpath.
 * Must also be present in Supabase → Auth → URL Configuration → Redirect URLs.
 */
function appRedirectUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

// ── Sign up ────────────────────────────────────────────────────────────────

/**
 * Create a new account with email + password.
 * Supabase sends a confirmation email automatically.
 */
export async function signUp(email, password) {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: appRedirectUrl(),
    },
  })

  return { data, error }
}

// ── Sign in — password ─────────────────────────────────────────────────────

/**
 * Sign in with email and password.
 */
export async function signInWithPassword(email, password) {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  return { data, error }
}

// ── Sign in — magic link ───────────────────────────────────────────────────

/**
 * Send a magic link to the email. The user clicks it to sign in —
 * no password required.
 */
export async function signInWithMagicLink(email) {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: appRedirectUrl(),
    },
  })

  return { data, error }
}

// ── Sign out ───────────────────────────────────────────────────────────────

/**
 * End the current session.
 */
export async function signOut() {
  if (!supabase) return { error: null }
  const { error } = await supabase.auth.signOut()
  return { error }
}

// ── Delete account ────────────────────────────────────────────────────────

async function functionError(error, fallbackCode = 'ACCOUNT_DELETE_FAILED') {
  let code = fallbackCode
  try {
    const payload = await error?.context?.clone?.().json()
    if (typeof payload?.code === 'string') code = payload.code
  } catch {
    // A network or gateway error may not include a JSON response.
  }
  const normalized = new Error(code)
  normalized.code = code
  normalized.cause = error
  return normalized
}

/**
 * Permanently deletes the currently authenticated account through the
 * server-side Edge Function. No owner id is accepted from the browser.
 */
export async function deleteCloudAccount(confirmation) {
  if (!supabase) {
    const error = new Error('SUPABASE_DISABLED')
    error.code = 'SUPABASE_DISABLED'
    return { data: null, error }
  }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation },
  })
  if (error) return { data: null, error: await functionError(error, data?.code) }
  if (data?.code !== 'ACCOUNT_DELETED') {
    const unexpected = new Error(data?.code || 'ACCOUNT_DELETE_FAILED')
    unexpected.code = data?.code || 'ACCOUNT_DELETE_FAILED'
    return { data, error: unexpected }
  }
  return { data, error: null }
}

// ── Current user ───────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user, or null.
 */
export async function getUser() {
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Subscribe to auth state changes.
 * Returns the unsubscribe function.
 *
 * @param {(user: object|null) => void} callback
 */
export function onAuthChange(callback) {
  if (!supabase) return () => {}

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session?.user ?? null)
  )

  return () => subscription.unsubscribe()
}

/**
 * @file push.service.js
 *
 * Web Push subscription lifecycle (client side).
 *
 * The actual sending happens in the `send-reminders` Supabase Edge
 * Function (cron). This service only makes sure the current device
 * has a PushSubscription and that it is stored in `push_subscriptions`.
 *
 * Requirements for a subscription to exist:
 *   - Notification permission granted
 *   - Service worker active
 *   - Supabase session (rows are per-user, RLS enforced)
 *   - VITE_VAPID_PUBLIC_KEY configured
 *
 * `ensurePushSubscription()` checks all of that itself and silently
 * no-ops when something is missing, so callers can fire-and-forget on
 * app start, after sign-in, and after the permission is granted.
 */

import { supabase, isSupabaseEnabled } from './supabase/client.js'
import { getUser } from './supabase/auth.service.js'
import { notificationDeviceId } from './supabase/settings.service.js'
import { storage } from '@services/storage'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function publishPushState(active) {
  storage.write(storage.KEYS.PUSH_ACTIVE, Boolean(active))
  window.dispatchEvent(new CustomEvent('traker:push-state', { detail: { active: Boolean(active) } }))
}

/** True when the stack needed for Web Push exists in this browser. */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** True when push can actually be wired up (browser + config). */
export function isPushConfigured() {
  return isPushSupported() && isSupabaseEnabled && Boolean(VAPID_PUBLIC_KEY)
}

/** Standard base64url → Uint8Array conversion for applicationServerKey. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/**
 * Subscribe this device (or reuse the existing subscription) and
 * upsert it into Supabase keyed by endpoint.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 *   reason: 'unsupported' | 'no-vapid-key' | 'permission' | 'no-session'
 *         | 'subscribe-failed' | 'save-failed'
 */
export async function ensurePushSubscription() {
  if (!isPushSupported())  { publishPushState(false); return { ok: false, reason: 'unsupported' } }
  if (!isSupabaseEnabled)  { publishPushState(false); return { ok: false, reason: 'no-session' } }
  if (!VAPID_PUBLIC_KEY)   { publishPushState(false); return { ok: false, reason: 'no-vapid-key' } }
  if (Notification.permission !== 'granted') { publishPushState(false); return { ok: false, reason: 'permission' } }

  const user = await getUser()
  if (!user) { publishPushState(false); return { ok: false, reason: 'no-session' } }

  let subscription
  try {
    const registration = await navigator.serviceWorker.ready
    subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
  } catch (err) {
    console.warn('[push] subscribe failed:', err?.message)
    publishPushState(false)
    return { ok: false, reason: 'subscribe-failed' }
  }

  const json = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id:      user.id,
        endpoint:     subscription.endpoint,
        p256dh:       json.keys?.p256dh ?? '',
        auth:         json.keys?.auth   ?? '',
        user_agent:   navigator.userAgent.slice(0, 255),
        device_id:    notificationDeviceId(),
        capabilities: {
          actions: false,
          displayMode: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
        },
        invalidated_at: null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.warn('[push] saving subscription failed:', error.message)
    publishPushState(false)
    return { ok: false, reason: 'save-failed' }
  }

  publishPushState(true)
  console.info('[push] Subscription active ✓')
  return { ok: true }
}

/**
 * Remove this device's subscription (browser + Supabase row).
 * Used when the user signs out or disables reminders.
 */
export async function removePushSubscription() {
  if (!isPushSupported()) return { ok: true }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      publishPushState(false)
      return { ok: true }
    }

    if (isSupabaseEnabled) {
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      if (error) return { ok: false, error }
    }
    await subscription.unsubscribe()
    publishPushState(false)
    return { ok: true }
  } catch (err) {
    console.warn('[push] unsubscribe failed:', err?.message)
    return { ok: false, error: err }
  }
}

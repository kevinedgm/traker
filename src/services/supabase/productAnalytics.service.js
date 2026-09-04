import { getUser } from './auth.service.js'
import { supabase } from './client.js'

export const PRODUCT_EVENT_TYPES = Object.freeze([
  'activation',
  'return',
  'habit_log',
  'day_close',
  'sync_conflict',
  'notification_delivery',
])

const EVENT_TYPES = new Set(PRODUCT_EVENT_TYPES)
const ERROR_CODES = new Set(['network', 'timeout', 'conflict', 'validation', 'unknown'])

export function productDurationBucket(durationMs) {
  if (durationMs === null || durationMs === undefined) return null
  const duration = Number(durationMs)
  if (!Number.isFinite(duration) || duration < 0) throw new TypeError('durationMs must be a non-negative number')
  if (duration < 10_000) return 'under_10s'
  if (duration < 60_000) return '10s_to_60s'
  if (duration < 300_000) return '1m_to_5m'
  return 'over_5m'
}

/**
 * Append one strictly content-free product event.
 * Consent is checked in the caller and enforced again by database RLS.
 */
export async function emitProductEvent(
  { eventType, durationMs = null, errorCode = null },
  { consented = false, client = supabase, userProvider = getUser } = {},
) {
  if (!EVENT_TYPES.has(eventType)) throw new TypeError(`Unsupported product event: ${eventType}`)
  if (errorCode !== null && !ERROR_CODES.has(errorCode)) throw new TypeError(`Unsupported product error code: ${errorCode}`)
  if (!consented) return { status: 'skipped', reason: 'consent_required' }
  if (!client) return { status: 'skipped', reason: 'cloud_unavailable' }

  const user = await userProvider()
  if (!user?.id) return { status: 'skipped', reason: 'authentication_required' }

  const { data, error } = await client
    .from('traker_product_events')
    .insert({
      user_id: user.id,
      event_type: eventType,
      duration_bucket: productDurationBucket(durationMs),
      error_code: errorCode,
    })
    .select('id')
    .single()

  if (error) return { status: 'rejected', error }
  return { status: 'emitted', id: data.id }
}


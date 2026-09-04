/**
 * @file supabase/settings.service.js
 *
 * Upserts the reminder-related user preferences into the `settings`
 * table so the send-reminders edge function (cron) can read them.
 *
 * Only the fields the server needs are synced — display preferences
 * (theme, grid density, …) stay local-first as before.
 */

import { supabase } from './client.js'
import { storage } from '@services/storage'

/** IANA timezone of this device (the cron schedules in the user's local time). */
export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City'
  } catch {
    return 'America/Mexico_City'
  }
}

export function notificationDeviceId() {
  const existing = storage.read(storage.KEYS.DEVICE_ID, null)
  if (typeof existing === 'string' && existing.length >= 16) return existing
  const created = globalThis.crypto?.randomUUID?.()
    ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`
  storage.write(storage.KEYS.DEVICE_ID, created)
  return created
}

export function toNotificationPreferenceRow(userId, s, deviceId = notificationDeviceId()) {
  return {
    user_id: userId,
    device_id: deviceId,
    morning_enabled: Boolean(s.morningReminderEnabled),
    habit_enabled: Boolean(s.habitRemindersEnabled ?? true),
    closing_enabled: Boolean(s.closingReminderEnabled ?? s.inactivityReminderEnabled ?? true),
    return_enabled: Boolean(s.returnReminderEnabled ?? true),
    morning_time: s.morningReminderTime || '08:00',
    closing_time: s.closingReminderTime || s.inactivityReminderTime || '20:00',
    quiet_start: s.notificationQuietStart || '21:30',
    quiet_end: s.notificationQuietEnd || '07:30',
    timezone: deviceTimezone(),
    daily_budget: Math.min(6, Math.max(0, Number(s.notificationDailyBudget ?? 2))),
    lock_screen_privacy: s.lockScreenPrivacy === 'names_allowed' ? 'names_allowed' : 'generic',
    direct_actions_enabled: s.notificationDirectActionsEnabled === true,
    silenced_until: s.notificationSilencedUntil || null,
  }
}

/**
 * Upsert reminder preferences for `userId`.
 * @param {string} userId
 * @param {object} s — settings store state (or compatible shape)
 */
export async function upsertReminderSettings(userId, s) {
  if (!supabase) return { data: null, error: null }

  const legacy = await supabase
    .from('settings')
    .upsert(
      {
        user_id:                     userId,
        notifications_enabled:       Boolean(s.notificationsEnabled),
        morning_reminder_enabled:    Boolean(s.morningReminderEnabled),
        morning_reminder_time:       s.morningReminderTime    || '08:00',
        inactivity_reminder_enabled: Boolean(s.inactivityReminderEnabled),
        inactivity_reminder_time:    s.inactivityReminderTime || '20:00',
        daily_checkin_prompt:         s.dailyCheckinPrompt === 'never' ? 'never' : 'ask',
        timezone:                    deviceTimezone(),
        // Copy/personality tone — the only personality field that crosses to
        // the server, because send-reminders (cron) needs it to pick its
        // own copy pool. Custom per-habit phrases never sync (client-only).
        tone:                        ['normal', 'trusted', 'no_respect'].includes(s.tone) ? s.tone : 'no_respect',
      },
      { onConflict: 'user_id' },
    )
  if (legacy.error) return legacy

  return supabase
    .from('traker_notification_preferences')
    .upsert(toNotificationPreferenceRow(userId, s), { onConflict: 'user_id,device_id' })
}

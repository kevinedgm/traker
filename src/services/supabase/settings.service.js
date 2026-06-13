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

/** IANA timezone of this device (the cron schedules in the user's local time). */
export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City'
  } catch {
    return 'America/Mexico_City'
  }
}

/**
 * Upsert reminder preferences for `userId`.
 * @param {string} userId
 * @param {object} s — settings store state (or compatible shape)
 */
export async function upsertReminderSettings(userId, s) {
  if (!supabase) return { data: null, error: null }

  return supabase
    .from('settings')
    .upsert(
      {
        user_id:                     userId,
        notifications_enabled:       Boolean(s.notificationsEnabled),
        morning_reminder_enabled:    Boolean(s.morningReminderEnabled),
        morning_reminder_time:       s.morningReminderTime    || '08:00',
        inactivity_reminder_enabled: Boolean(s.inactivityReminderEnabled),
        inactivity_reminder_time:    s.inactivityReminderTime || '20:00',
        timezone:                    deviceTimezone(),
      },
      { onConflict: 'user_id' },
    )
}

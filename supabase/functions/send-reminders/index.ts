/**
 * send-reminders — Supabase Edge Function
 *
 * Invoked by pg_cron every 10 minutes. For every user with at least one
 * push subscription it checks, in the USER'S timezone, whether any of
 * these fell inside the last 10-minute window:
 *
 *   habit      — habit.reminder_time, weekday allowed, not logged today
 *   morning    — settings.morning_reminder_time (motivational)
 *   inactivity — settings.inactivity_reminder_time, nothing logged today
 *
 * Anti-spam: each (user, kind, ref) is sent at most once per local day,
 * enforced by the sent_reminders unique constraint — safe even if the
 * cron overlaps or retries.
 *
 * Secrets (supabase secrets set …):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
 *
 * Deploy:  supabase functions deploy send-reminders --no-verify-jwt
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const WINDOW_MINUTES = 10

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  'mailto:kevinedgm@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

// ── Timezone helpers ────────────────────────────────────────────────────────

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** Local date parts for `date` in IANA timezone `tz`. */
function localParts(tz: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  })
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]))
  return {
    dateStr: `${p.year}-${p.month}-${p.day}`,            // YYYY-MM-DD local
    minutes: Number(p.hour) * 60 + Number(p.minute),      // minutes since local midnight
    weekday: WEEKDAYS[p.weekday] ?? 0,                    // 0=Sun … 6=Sat
  }
}

/** "HH:MM" → minutes since midnight, or null if malformed. */
function hhmmToMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** True if `target` fell inside (now - WINDOW, now]. No midnight wrap: a
 *  reminder in the last minutes of the day still matches before midnight. */
function isDue(target: number | null, nowMin: number): boolean {
  if (target === null) return false
  const diff = nowMin - target
  return diff >= 0 && diff < WINDOW_MINUTES
}

/** Whole local days between two YYYY-MM-DD strings. */
function daysBetween(fromDateStr: string, toDateStr: string): number {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number)
  const [ty, tm, td] = toDateStr.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

// ── Copy (same non-punishing tone as the app) ──────────────────────────────

const MORNING_MESSAGES = [
  'Buen día. Hoy también cuenta un paso pequeño.',
  'Empieza suave: un registro basta para tomar impulso.',
  'No tienes que hacerlo perfecto, solo empezar hoy.',
  'Hazlo fácil para tu yo de esta mañana: un paso y seguimos.',
]

// ── Push sending ────────────────────────────────────────────────────────────

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Payload {
  title: string
  body: string
  tag: string
  data: { url: string }
}

async function sendToUser(subs: Sub[], payload: Payload): Promise<number> {
  let delivered = 0
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
      delivered++
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      // 404/410 = endpoint dead (app uninstalled, permission revoked)
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.warn(`[push] send failed (${status}):`, (err as Error)?.message)
      }
    }
  }))
  return delivered
}

/** Claim a (user, kind, ref, day) slot. True = we own it, send the push. */
async function claim(userId: string, kind: string, ref: string, sentOn: string): Promise<boolean> {
  const { error } = await supabase
    .from('sent_reminders')
    .insert({ user_id: userId, kind, ref, sent_on: sentOn })
  if (!error) return true
  if (error.code === '23505') return false   // unique violation — already sent today
  console.warn('[claim] unexpected error:', error.message)
  return false
}

// ── Row shapes (Supabase has no generated types here) ───────────────────────

interface HabitRow {
  id: string
  user_id: string
  title: string
  icon: string | null
  total_days: number | null
  reminder_time: string | null
  reminder_days: number[] | null
  created_at: string
}

interface SettingsRow {
  user_id: string
  notifications_enabled: boolean | null
  timezone: string | null
  morning_reminder_enabled: boolean | null
  morning_reminder_time: string | null
  inactivity_reminder_enabled: boolean | null
  inactivity_reminder_time: string | null
}

// ── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // pg_cron authenticates with a shared secret, not a user JWT
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: allSubs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
  if (subsErr) return new Response(subsErr.message, { status: 500 })
  if (!allSubs?.length) return Response.json({ ok: true, sent: 0, reason: 'no subscriptions' })

  const userIds = [...new Set(allSubs.map(s => s.user_id))]

  const [{ data: allSettings }, { data: allHabits }] = await Promise.all([
    supabase.from('settings').select('*').in('user_id', userIds),
    supabase.from('habits').select('*').in('user_id', userIds).eq('is_active', true),
  ])

  let sent = 0

  const settingsRows = (allSettings ?? []) as SettingsRow[]
  const habitRows    = (allHabits  ?? []) as HabitRow[]

  for (const userId of userIds) {
    const subs     = allSubs.filter(s => s.user_id === userId)
    const settings = settingsRows.find(s => s.user_id === userId) ?? null
    const habits   = habitRows.filter(h => h.user_id === userId)

    // User explicitly turned reminders off → respect it
    if (settings && settings.notifications_enabled === false) continue

    const tz  = settings?.timezone || 'America/Mexico_City'
    let now
    try { now = localParts(tz) } catch { now = localParts('America/Mexico_City') }

    // ── Which habits are due / logged today? ──────────────────────────
    type DueHabit = { habit: HabitRow, dayNumber: number }
    const dueHabits: DueHabit[] = []
    const todayDayByHabit = new Map<string, number>()

    for (const habit of habits) {
      const createdLocal = localParts(tz, new Date(habit.created_at))
      const dayNumber = daysBetween(createdLocal.dateStr, now.dateStr) + 1
      if (dayNumber < 1 || dayNumber > Number(habit.total_days ?? 1)) continue
      todayDayByHabit.set(habit.id, dayNumber)

      if (!isDue(hhmmToMinutes(habit.reminder_time), now.minutes)) continue
      const days = habit.reminder_days
      if (Array.isArray(days) && days.length > 0 && !days.includes(now.weekday)) continue
      dueHabits.push({ habit, dayNumber })
    }

    // ── What's already logged today? (one query per user) ─────────────
    const loggedToday = new Set<string>()
    if (todayDayByHabit.size) {
      const { data: entries } = await supabase
        .from('habit_entries')
        .select('habit_id, day_number')
        .in('habit_id', [...todayDayByHabit.keys()])
      for (const e of entries ?? []) {
        if (todayDayByHabit.get(e.habit_id as string) === e.day_number) {
          loggedToday.add(e.habit_id as string)
        }
      }
    }

    // ── 1. Per-habit reminders ─────────────────────────────────────────
    for (const { habit } of dueHabits) {
      if (loggedToday.has(habit.id)) continue
      if (!await claim(userId, 'habit', habit.id, now.dateStr)) continue
      sent += await sendToUser(subs, {
        title: `${habit.icon ?? ''} ${habit.title}`.trim(),
        body:  'Es un buen momento. Una versión mínima también cuenta.',
        tag:   `habit-${habit.id}`,
        data:  { url: `/habit/${habit.id}` },
      })
    }

    // ── 2. Morning motivation ──────────────────────────────────────────
    if (
      settings?.morning_reminder_enabled &&
      habits.length > 0 &&
      isDue(hhmmToMinutes(settings.morning_reminder_time), now.minutes) &&
      await claim(userId, 'morning', '-', now.dateStr)
    ) {
      const idx = new Date().getDate() % MORNING_MESSAGES.length
      sent += await sendToUser(subs, {
        title: 'Traker',
        body:  MORNING_MESSAGES[idx],
        tag:   'daily-morning-motivation',
        data:  { url: '/' },
      })
    }

    // ── 3. Inactivity (nothing logged today) ───────────────────────────
    if (
      settings?.inactivity_reminder_enabled &&
      habits.length > 0 &&
      loggedToday.size === 0 &&
      isDue(hhmmToMinutes(settings.inactivity_reminder_time), now.minutes) &&
      await claim(userId, 'inactivity', '-', now.dateStr)
    ) {
      sent += await sendToUser(subs, {
        title: 'Traker',
        body:  'Todavía puedes cerrar el día. Un paso pequeño también cuenta.',
        tag:   'daily-inactivity-reminder',
        data:  { url: '/' },
      })
    }
  }

  return Response.json({ ok: true, sent })
})

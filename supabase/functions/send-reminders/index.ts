/**
 * Reliable notification worker.
 *
 * One cron invocation first plans idempotent jobs, then atomically leases a
 * bounded batch. Delivery success closes the job; transient failures return it
 * to the queue with backoff; dead subscriptions are invalidated on 404/410.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { evaluateNotificationPlan, localTimeParts } from '../_shared/notification-planner.js'
import { deliveryFailureDecision } from '../_shared/notification-worker.js'
import { actionsForNotification } from '../_shared/notification-actions.js'

const WINDOW_MINUTES = 10
const LOOKBACK_ISO = new Date(Date.now() - 32 * 86_400_000).toISOString()
const LOOKBACK_DATE = LOOKBACK_ISO.slice(0, 10)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

let webPushConfigured = false

function configureWebPush() {
  if (webPushConfigured) return true
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails('mailto:kevinedgm@gmail.com', publicKey, privateKey)
  webPushConfigured = true
  return true
}

type JsonRecord = Record<string, unknown>

interface SubscriptionRow {
  id: string
  user_id: string
  device_id: string | null
  endpoint: string
  p256dh: string
  auth: string
  invalidated_at: string | null
}

interface PreferenceRow {
  user_id: string
  device_id: string | null
  morning_enabled: boolean
  habit_enabled: boolean
  closing_enabled: boolean
  return_enabled: boolean
  morning_time: string
  closing_time: string
  quiet_start: string
  quiet_end: string
  timezone: string
  daily_budget: number
  lock_screen_privacy: string
  silenced_until: string | null
  direct_actions_enabled: boolean
}

interface HabitRow {
  id: string
  user_id: string
  reminder_time: string | null
  created_at: string
  total_days: number | null
  is_active: boolean
}

interface ScheduleRow {
  habit_id: string
  kind: 'weekdays' | 'times_per_week' | 'times_per_month' | 'every_n_days' | 'window'
  timezone: string
  days_of_week: number[] | null
  interval_days: number | null
  period_minimum: number | null
  window_start: string | null
  window_end: string | null
  effective_from: string
  effective_to: string | null
  is_active: boolean
}

interface LogRow {
  user_id: string
  habit_id: string
  local_date: string
  status: 'not_done' | 'partial' | 'done' | 'conscious_skip'
  occurred_at: string
}

interface JobRow {
  id: string
  user_id: string
  kind: string
  payload: JsonRecord
  scheduled_at: string
  expires_at: string
  attempt_count: number
}

function dateDistance(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

function weekday(localDate: string) {
  return new Date(`${localDate}T12:00:00.000Z`).getUTCDay()
}

function periodStart(localDate: string, kind: ScheduleRow['kind']) {
  if (kind === 'times_per_month') return `${localDate.slice(0, 8)}01`
  const offset = (weekday(localDate) + 6) % 7
  return new Date(Date.parse(`${localDate}T12:00:00.000Z`) - offset * 86_400_000).toISOString().slice(0, 10)
}

function isScheduled(habit: HabitRow, schedule: ScheduleRow | undefined, localDate: string, logs: LogRow[]) {
  if (!schedule || schedule.is_active === false) return false
  if (localDate < schedule.effective_from) return false
  if (schedule.effective_to && localDate > schedule.effective_to) return false
  if (schedule.kind === 'weekdays' && !schedule.days_of_week?.includes(weekday(localDate))) return false
  if (schedule.kind === 'every_n_days' && dateDistance(schedule.effective_from, localDate) % Math.max(1, Number(schedule.interval_days ?? 1)) !== 0) return false
  if (schedule.kind === 'times_per_week' || schedule.kind === 'times_per_month') {
    const registeredToday = logs.some(log => log.habit_id === habit.id && log.local_date === localDate)
    const start = [periodStart(localDate, schedule.kind), schedule.effective_from].sort().at(-1)!
    const built = new Set(logs
      .filter(log => log.habit_id === habit.id && log.local_date >= start && log.local_date <= localDate && ['partial', 'done'].includes(log.status))
      .map(log => log.local_date)).size
    if (!registeredToday && built >= Math.max(1, Number(schedule.period_minimum ?? 1))) return false
  }
  const createdDate = localTimeParts(new Date(habit.created_at), schedule?.timezone).localDate
  const day = dateDistance(createdDate, localDate) + 1
  return day >= 1 && day <= Math.max(1, Number(habit.total_days ?? 1))
}

function preferenceFor(subscription: SubscriptionRow, rows: PreferenceRow[]) {
  return rows.find(row => row.user_id === subscription.user_id && row.device_id === subscription.device_id)
    ?? rows.find(row => row.user_id === subscription.user_id && row.device_id === null)
    ?? null
}

function plannerSettings(preference: PreferenceRow | null, enabled: boolean) {
  return {
    enabled,
    morning_enabled: preference?.morning_enabled ?? true,
    habit_enabled: preference?.habit_enabled ?? true,
    closing_enabled: preference?.closing_enabled ?? true,
    return_enabled: preference?.return_enabled ?? true,
    morning_time: preference?.morning_time ?? '08:00',
    closing_time: preference?.closing_time ?? '20:00',
    quiet_start: preference?.quiet_start ?? '21:30',
    quiet_end: preference?.quiet_end ?? '07:30',
    daily_budget: preference?.daily_budget ?? 2,
    silenced_until: preference?.silenced_until ?? null,
    lock_screen_privacy: preference?.lock_screen_privacy ?? 'generic',
  }
}

async function loadPlanningData() {
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, device_id, endpoint, p256dh, auth, invalidated_at')
    .is('invalidated_at', null)
  if (error) throw error
  const subs = (subscriptions ?? []) as SubscriptionRow[]
  if (!subs.length) return { subs, preferences: [], legacySettings: [], habits: [], schedules: [], logs: [], closures: [], jobs: [], latestActivity: [] }

  const userIds = [...new Set(subs.map(row => row.user_id))]
  const [preferences, legacySettings, habits, schedules, logs, closures, jobs, latestActivity] = await Promise.all([
    supabase.from('traker_notification_preferences').select('*').in('user_id', userIds),
    supabase.from('settings').select('user_id, notifications_enabled, timezone').in('user_id', userIds),
    supabase.from('habits').select('id, user_id, reminder_time, created_at, total_days, is_active').in('user_id', userIds).eq('is_active', true),
    supabase.from('traker_habit_schedules').select('habit_id, kind, timezone, days_of_week, interval_days, period_minimum, window_start, window_end, effective_from, effective_to, is_active').in('user_id', userIds).is('deleted_at', null).eq('is_active', true),
    supabase.from('traker_habit_logs').select('user_id, habit_id, local_date, status, occurred_at').in('user_id', userIds).is('deleted_at', null).gte('local_date', LOOKBACK_DATE),
    supabase.from('traker_day_closures').select('user_id, local_date, status').in('user_id', userIds).gte('local_date', LOOKBACK_ISO.slice(0, 10)),
    supabase.from('traker_notification_jobs').select('user_id, kind, job_key, status, scheduled_at, payload').in('user_id', userIds).eq('status', 'completed').gte('scheduled_at', LOOKBACK_ISO),
    supabase.rpc('traker_latest_habit_activity', { p_user_ids: userIds }),
  ])

  for (const result of [preferences, legacySettings, habits, schedules, logs, closures, jobs, latestActivity]) {
    if (result.error) throw result.error
  }
  return {
    subs,
    preferences: (preferences.data ?? []) as PreferenceRow[],
    legacySettings: legacySettings.data ?? [],
    habits: (habits.data ?? []) as HabitRow[],
    schedules: (schedules.data ?? []) as ScheduleRow[],
    logs: (logs.data ?? []) as LogRow[],
    closures: closures.data ?? [],
    jobs: jobs.data ?? [],
    latestActivity: latestActivity.data ?? [],
  }
}

async function planJobs(now: Date) {
  const data = await loadPlanningData()
  const rows: JsonRecord[] = []

  for (const subscription of data.subs) {
    const preference = preferenceFor(subscription, data.preferences)
    const legacy = data.legacySettings.find(row => row.user_id === subscription.user_id)
    const timezone = preference?.timezone || legacy?.timezone || 'America/Mexico_City'
    const localDate = localTimeParts(now, timezone).localDate
    const userHabits = data.habits.filter(habit => habit.user_id === subscription.user_id)
    const userLogs = data.logs.filter(log => log.user_id === subscription.user_id)
    const agenda = userHabits
      .filter(habit => {
        const schedule = data.schedules.find(item => item.habit_id === habit.id)
        return isScheduled(habit, schedule, localDate, userLogs)
      })
      .map(habit => ({
        id: habit.id,
        reminderTime: habit.reminder_time,
        registered: userLogs.some(log => log.habit_id === habit.id && log.local_date === localDate),
      }))

    const latestActivity = new Date(
      data.latestActivity.find(row => row.user_id === subscription.user_id)?.last_activity ?? 0,
    ).getTime()
    const history = data.jobs
      .filter(job => job.user_id === subscription.user_id && job.payload?.subscription_id === subscription.id)
      .map(job => ({
        kind: job.kind,
        jobKey: String(job.job_key).split(`:${subscription.id}`)[0],
        at: job.scheduled_at,
        localDate: job.payload?.local_date,
        phraseId: job.payload?.phrase_id,
        copyVersion: job.payload?.copy_version,
      }))
    const dayClosure = data.closures.find(row => row.user_id === subscription.user_id && row.local_date === localDate) ?? null
    const evaluation = evaluateNotificationPlan({
      now,
      timezone,
      agenda,
      settings: plannerSettings(preference, legacy?.notifications_enabled !== false),
      history,
      dayClosure,
      daysSinceActivity: Number.isFinite(latestActivity) && latestActivity > 0
        ? Math.floor((now.getTime() - latestActivity) / 86_400_000)
        : 0,
      windowMinutes: WINDOW_MINUTES,
    })
    const intent = evaluation.intentions[0]
    if (!intent) continue
    rows.push({
      user_id: subscription.user_id,
      job_key: `${intent.jobKey}:${subscription.id}`,
      kind: intent.kind,
      payload: {
        subscription_id: subscription.id,
        local_date: evaluation.localDate,
        title: intent.title,
        body: intent.body,
        phrase_id: intent.phraseId,
        copy_version: intent.copyVersion,
        copy_hash: intent.copyHash,
        url: intent.url,
        reference_ids: intent.referenceIds,
        direct_actions_enabled: preference?.direct_actions_enabled === true,
      },
      scheduled_at: intent.scheduledAt,
      expires_at: intent.expiresAt,
      status: 'queued',
      next_attempt_at: intent.scheduledAt,
    })
  }

  if (!rows.length) return 0
  const { error } = await supabase
    .from('traker_notification_jobs')
    .upsert(rows, { onConflict: 'user_id,job_key', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}

async function updateJob(id: string, patch: JsonRecord) {
  const { error } = await supabase.from('traker_notification_jobs').update(patch).eq('id', id)
  if (error) throw error
}

async function deliverJob(job: JobRow) {
  const subscriptionId = String(job.payload?.subscription_id ?? '')
  const { data: subscription } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, invalidated_at')
    .eq('id', subscriptionId)
    .eq('user_id', job.user_id)
    .is('invalidated_at', null)
    .maybeSingle()

  if (!subscription) {
    await updateJob(job.id, { status: 'suppressed', lease_until: null, suppression_reason: 'no_active_subscription' })
    return 'suppressed'
  }

  const attempt = job.attempt_count
  const delivery = await supabase
    .from('traker_notification_deliveries')
    .insert({
      user_id: job.user_id,
      job_id: job.id,
      subscription_id: subscription.id,
      attempt,
      status: 'sending',
    })
    .select('id')
    .single()
  if (delivery.error) throw delivery.error

  try {
    const referenceIds = Array.isArray(job.payload?.reference_ids)
      ? job.payload.reference_ids.map(String)
      : []
    const actions = actionsForNotification({
      kind: job.kind,
      referenceIds,
      directActionsEnabled: job.payload?.direct_actions_enabled === true,
    })
    const habitId = actions.length ? referenceIds[0] : null
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({
        title: String(job.payload?.title ?? 'Traker'),
        body: String(job.payload?.body ?? ''),
        tag: habitId ? `habit-${habitId}` : `traker-${job.kind}`,
        actions,
        data: {
          url: String(job.payload?.url ?? '/'),
          phraseId: String(job.payload?.phrase_id ?? ''),
          copyVersion: String(job.payload?.copy_version ?? ''),
          habitId,
        },
      }),
    )
    const sentAt = new Date().toISOString()
    await Promise.all([
      supabase.from('traker_notification_deliveries').update({ status: 'delivered', sent_at: sentAt }).eq('id', delivery.data.id),
      supabase.from('push_subscriptions').update({ last_success_at: sentAt, failure_count: 0 }).eq('id', subscription.id),
      updateJob(job.id, { status: 'completed', lease_until: null, suppression_reason: null }),
    ])
    return 'delivered'
  } catch (error) {
    const status = Number((error as { statusCode?: number })?.statusCode || 0)
    const errorCode = status ? `http_${status}` : 'network_error'
    const decision = deliveryFailureDecision({
      status,
      attempt,
      expiresAt: job.expires_at,
      now: new Date(),
    })
    if (decision.action === 'invalidate') {
      await Promise.all([
        supabase.from('traker_notification_deliveries').update({ status: 'invalid_subscription', provider_status: status, error_code: errorCode }).eq('id', delivery.data.id),
        supabase.from('push_subscriptions').update({ invalidated_at: new Date().toISOString(), failure_count: 1 }).eq('id', subscription.id),
        updateJob(job.id, { status: 'suppressed', lease_until: null, suppression_reason: 'invalid_subscription' }),
      ])
      return 'invalid_subscription'
    }

    await supabase.from('traker_notification_deliveries')
      .update({ status: 'failed', provider_status: status || null, error_code: errorCode })
      .eq('id', delivery.data.id)
    await supabase.from('push_subscriptions').update({ failure_count: attempt }).eq('id', subscription.id)

    if (decision.action === 'retry') {
      await updateJob(job.id, {
        status: 'queued',
        lease_until: null,
        next_attempt_at: decision.retryAt,
        suppression_reason: null,
      })
      return 'retrying'
    }
    await updateJob(job.id, {
      status: 'expired',
      lease_until: null,
      suppression_reason: decision.reason,
    })
    return 'failed'
  }
}

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    console.error('[send-reminders] CRON_SECRET is not configured')
    return Response.json({ ok: false, error: 'worker_not_configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 })
  if (!configureWebPush()) {
    console.error('[send-reminders] VAPID keys are not configured')
    return Response.json({ ok: false, error: 'worker_not_configured' }, { status: 503 })
  }

  try {
    const planned = await planJobs(new Date())
    const { data: claimed, error } = await supabase.rpc('traker_claim_notification_jobs', {
      p_limit: 25,
      p_lease_seconds: 120,
    })
    if (error) throw error
    const outcomes = await Promise.all(((claimed ?? []) as JobRow[]).map(deliverJob))
    return Response.json({
      ok: true,
      planned,
      claimed: outcomes.length,
      delivered: outcomes.filter(outcome => outcome === 'delivered').length,
      retrying: outcomes.filter(outcome => outcome === 'retrying').length,
      invalidated: outcomes.filter(outcome => outcome === 'invalid_subscription').length,
    })
  } catch (error) {
    console.error('[send-reminders]', error)
    return Response.json({ ok: false, error: (error as Error)?.message ?? 'worker_error' }, { status: 500 })
  }
})

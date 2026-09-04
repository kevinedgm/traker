/**
 * Supabase persistence for the canonical habit vertical slice.
 *
 * Goal relationships, schedules and logs are stored in their dedicated v2
 * tables. Legacy compatibility columns remain in PostgreSQL only as a
 * rollback boundary during Phase 6.
 */

import { supabase } from './client.js'
import {
  currentTimezone,
  localDateKey,
  normalizeHabitLogOutcome,
  normalizeGoalIds,
  normalizeHabitSchedule,
} from '@/features/habits/domain.js'

function success(data = null) {
  return { data, error: null }
}

export function toRemoteHabit(habit, userId) {
  const schedule = normalizeHabitSchedule(habit.schedule, habit.reminderDays, habit.createdAt)
  return {
    id: habit.id,
    user_id: userId,
    title: habit.name,
    minimum_version: habit.minimumVersion ?? '',
    icon: habit.icon ?? null,
    color: habit.color ?? null,
    total_days: habit.duration,
    reminder_time: habit.reminder ?? null,
    copy_settings: habit.copySettings ?? null,
    is_active: habit.isActive ?? true,
    lifecycle_status: habit.lifecycleStatus ?? (habit.isActive === false ? 'paused' : 'active'),
    timezone: schedule.timezone,
    version: Math.max(1, Number(habit.version) || 1),
    created_at: habit.createdAt,
    updated_at: habit.updatedAt ?? new Date().toISOString(),
  }
}

export function toRemoteSchedule(habit, userId) {
  const schedule = normalizeHabitSchedule(habit.schedule, habit.reminderDays, habit.createdAt)
  return {
    id: schedule.id,
    user_id: userId,
    habit_id: habit.id,
    kind: schedule.kind,
    timezone: schedule.timezone,
    effective_from: schedule.effectiveFrom,
    effective_to: schedule.effectiveTo,
    days_of_week: schedule.daysOfWeek,
    interval_days: schedule.intervalDays,
    period_minimum: schedule.periodMinimum,
    period_target: schedule.periodTarget,
    period_extra: schedule.periodExtra,
    window_start: schedule.windowStart,
    window_end: schedule.windowEnd,
    is_active: schedule.isActive,
    version: schedule.version,
    deleted_at: null,
  }
}

export function fromRemoteSchedule(schedule) {
  if (!schedule) return null
  return normalizeHabitSchedule({
    id: schedule.id,
    kind: schedule.kind,
    timezone: schedule.timezone,
    daysOfWeek: schedule.days_of_week,
    intervalDays: schedule.interval_days,
    periodMinimum: schedule.period_minimum,
    periodTarget: schedule.period_target,
    periodExtra: schedule.period_extra,
    windowStart: schedule.window_start?.slice?.(0, 5) ?? schedule.window_start,
    windowEnd: schedule.window_end?.slice?.(0, 5) ?? schedule.window_end,
    effectiveFrom: schedule.effective_from,
    effectiveTo: schedule.effective_to,
    isActive: schedule.is_active,
    version: schedule.version,
  }, null, schedule.created_at)
}

export function toRemoteHabitLog(habitId, log, userId) {
  const timezone = log.timezone ?? currentTimezone()
  const localDate = log.localDate ?? localDateKey(log.loggedAt, timezone)
  const outcome = normalizeHabitLogOutcome(log)
  const contextCodes = [...new Set([
    ...outcome.contextCodes.filter(code => !code.startsWith('emotion:') && !code.startsWith('energy:')),
    log.emotion ? `emotion:${log.emotion}` : null,
    log.energy ? `energy:${log.energy}` : null,
  ].filter(Boolean))]
  return {
    id: log.id,
    user_id: userId,
    habit_id: habitId,
    local_date: localDate,
    timezone,
    occurrence_key: log.occurrenceKey ?? `date:${localDate}`,
    status: outcome.status,
    minimum_used: outcome.minimumUsed,
    context_codes: contextCodes.length ? contextCodes : null,
    note: log.note ?? '',
    occurred_at: log.loggedAt ?? new Date().toISOString(),
    client_operation_id: log.clientOperationId,
    version: Math.max(1, Number(log.version) || 1),
    updated_at: log.loggedAt ?? new Date().toISOString(),
    edited_at: Number(log.version) > 1 ? (log.loggedAt ?? new Date().toISOString()) : null,
    deleted_at: null,
  }
}

export async function fetchHabits() {
  if (!supabase) return success([])
  return supabase
    .from('habits')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
}

export async function fetchHabitGoalLinks() {
  if (!supabase) return success([])
  return supabase
    .from('traker_habit_goal_links')
    .select('id,habit_id,goal_id,deleted_at,created_at')
    .order('created_at', { ascending: true })
}

export async function fetchHabitSchedules() {
  if (!supabase) return success([])
  return supabase
    .from('traker_habit_schedules')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
}

export async function fetchHabitLogs() {
  if (!supabase) return success([])
  return supabase
    .from('traker_habit_logs')
    .select('*')
    .is('deleted_at', null)
    .order('local_date', { ascending: true })
}

export async function upsertHabit(habit, userId) {
  if (!supabase) return success()
  return supabase
    .from('habits')
    .upsert(toRemoteHabit(habit, userId), { onConflict: 'id' })
    .select()
    .single()
}

export async function syncHabitGoalLinks(habit, userId) {
  if (!supabase) return success([])
  const desired = new Set(normalizeGoalIds(habit.goalIds, habit.goalId))
  const { data: existing, error } = await supabase
    .from('traker_habit_goal_links')
    .select('id,goal_id,deleted_at')
    .eq('habit_id', habit.id)
  if (error) return { data: null, error }

  const now = new Date().toISOString()
  const activeByGoal = new Map()
  const deletedByGoal = new Map()
  for (const link of existing ?? []) {
    const target = link.deleted_at ? deletedByGoal : activeByGoal
    if (!target.has(link.goal_id)) target.set(link.goal_id, link)
  }

  for (const [goalId, link] of activeByGoal) {
    if (desired.has(goalId)) continue
    const result = await supabase
      .from('traker_habit_goal_links')
      .update({ deleted_at: now })
      .eq('id', link.id)
    if (result.error) return result
  }

  for (const goalId of desired) {
    if (activeByGoal.has(goalId)) continue
    const deleted = deletedByGoal.get(goalId)
    const result = deleted
      ? await supabase
          .from('traker_habit_goal_links')
          .update({ deleted_at: null })
          .eq('id', deleted.id)
      : await supabase
          .from('traker_habit_goal_links')
          .insert({ user_id: userId, habit_id: habit.id, goal_id: goalId })
    if (result.error) return result
  }

  return success([...desired])
}

export async function upsertHabitSchedule(habit, userId) {
  if (!supabase) return success()
  return supabase
    .from('traker_habit_schedules')
    .upsert(toRemoteSchedule(habit, userId), { onConflict: 'id' })
    .select()
    .single()
}

export async function upsertHabitBundle(habit, userId) {
  const habitResult = await upsertHabit(habit, userId)
  let deferredGoalLinks = false
  if (habitResult.error) return habitResult
  const linksResult = await syncHabitGoalLinks(habit, userId)
  if (linksResult.error?.code === '23503') deferredGoalLinks = true
  else if (linksResult.error) return linksResult
  const scheduleResult = await upsertHabitSchedule(habit, userId)
  if (scheduleResult.error) return scheduleResult
  return success({
    habit: habitResult.data,
    goalIds: linksResult.data ?? [],
    schedule: scheduleResult.data,
    deferredGoalLinks,
  })
}

export async function deleteHabit(habitId) {
  if (!supabase) return success()
  return supabase.from('habits').delete().eq('id', habitId)
}

export async function upsertHabitLog(habitId, log, userId) {
  if (!supabase) return success()
  return supabase
    .from('traker_habit_logs')
    .upsert(toRemoteHabitLog(habitId, log, userId), { onConflict: 'id' })
    .select()
    .single()
}

export async function deleteHabitLog(habitId, log) {
  if (!supabase || !log) return success()
  const now = new Date().toISOString()
  const query = supabase
    .from('traker_habit_logs')
    .update({
      deleted_at: now,
      edited_at: now,
      version: Math.max(1, Number(log.version) || 1) + 1,
    })
    .eq('habit_id', habitId)
  return log.id ? query.eq('id', log.id) : query.eq('occurrence_key', log.occurrenceKey)
}

export async function bulkUpsertHabitLogs(habitId, logs, userId) {
  if (!supabase || !logs || !Object.keys(logs).length) return success()
  const rows = Object.values(logs).map(log => toRemoteHabitLog(habitId, log, userId))
  return supabase.from('traker_habit_logs').upsert(rows, { onConflict: 'id' })
}

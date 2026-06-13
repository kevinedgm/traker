/**
 * @file supabase/habits.service.js
 *
 * CRUD for the `habits` and `habit_entries` tables.
 *
 * All methods:
 *  - Return { data, error } (Supabase SDK convention)
 *  - Are no-ops when Supabase isn't configured
 *  - Never throw — errors are always returned, not thrown
 *
 * Data shape in Supabase:
 *
 *   habits:
 *     id, user_id, title, icon, color, total_days,
 *     reminder_time, is_active, created_at, updated_at
 *
 *   habit_entries:
 *     id, habit_id, day_number, status, emotion, energy, note, created_at
 *
 * Mapping (local → remote):
 *   habit.name      → title
 *   habit.duration  → total_days
 *   habit.logs[day] → habit_entries row with day_number=day
 *   log.level       → status  ("0"|"1"|"2"|"3"|"4")
 */

import { supabase } from './client.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Map a local habit object → Supabase row. */
function toRemoteHabit(habit, userId) {
  return {
    id:            habit.id,
    user_id:       userId,
    title:         habit.name,
    icon:          habit.icon   ?? null,
    color:         habit.color  ?? null,
    total_days:    habit.duration,
    reminder_time: habit.reminder     ?? null,
    reminder_days: habit.reminderDays ?? null,
    is_active:     habit.isActive ?? true,
    created_at:    habit.createdAt,
    updated_at:    habit.updatedAt ?? new Date().toISOString(),
  }
}

/** Map a single log entry → Supabase habit_entries row. */
function toRemoteEntry(habitId, day, log) {
  return {
    habit_id:   habitId,
    day_number: day,
    status:     String(log.level ?? 0),
    emotion:    log.emotion ?? null,
    energy:     log.energy  ?? null,
    note:       log.note    ?? null,
    updated_at: log.loggedAt ?? new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Habits CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all habits for the current user.
 * Returns { data: [...remote habits], error }
 */
export async function fetchHabits() {
  if (!supabase) return { data: [], error: null }

  return supabase
    .from('habits')
    .select('*')
    .order('created_at', { ascending: true })
}

/**
 * Upsert a single habit (insert or update by id).
 */
export async function upsertHabit(habit, userId) {
  if (!supabase) return { data: null, error: null }

  return supabase
    .from('habits')
    .upsert(toRemoteHabit(habit, userId), { onConflict: 'id' })
    .select()
    .single()
}

/**
 * Permanently delete a habit. Entries are removed by ON DELETE CASCADE.
 */
export async function deleteHabit(habitId) {
  if (!supabase) return { data: null, error: null }

  return supabase
    .from('habits')
    .delete()
    .eq('id', habitId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entries (logs) CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all entries for a habit.
 */
export async function fetchEntries(habitId) {
  if (!supabase) return { data: [], error: null }

  return supabase
    .from('habit_entries')
    .select('*')
    .eq('habit_id', habitId)
    .order('day_number', { ascending: true })
}

/**
 * Upsert a single entry (log a day).
 * Uses (habit_id, day_number) as the conflict key.
 */
export async function upsertEntry(habitId, day, log) {
  if (!supabase) return { data: null, error: null }

  return supabase
    .from('habit_entries')
    .upsert(toRemoteEntry(habitId, day, log), { onConflict: 'habit_id,day_number' })
    .select()
    .single()
}

/**
 * Delete a specific day's entry.
 */
export async function deleteEntry(habitId, day) {
  if (!supabase) return { data: null, error: null }

  return supabase
    .from('habit_entries')
    .delete()
    .eq('habit_id', habitId)
    .eq('day_number', day)
}

/**
 * Bulk upsert all entries for a habit — used during initial sync push.
 */
export async function bulkUpsertEntries(habitId, logs) {
  if (!supabase || !logs || !Object.keys(logs).length) return { data: null, error: null }

  const rows = Object.entries(logs).map(([day, log]) =>
    toRemoteEntry(habitId, Number(day), log)
  )

  return supabase
    .from('habit_entries')
    .upsert(rows, { onConflict: 'habit_id,day_number' })
}

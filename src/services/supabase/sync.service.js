/**
 * @file supabase/sync.service.js
 *
 * Offline-first sync orchestrator.
 *
 * Architecture:
 *
 *   User action
 *     → Pinia store mutates
 *     → localStorage writes immediately  (persistence plugin)
 *     → sync.push(change) called
 *         → if online:  pushes to Supabase immediately
 *         → if offline: queues in localStorage (traker:sync-queue)
 *
 *   On network reconnect:
 *     → flushQueue() drains every pending operation
 *
 *   On sign-in:
 *     → pullAll() fetches cloud state and merges into Pinia
 *
 * Conflict resolution is handled in the Pinia store when cloud data is merged:
 * localStorage remains immediate, and each daily entry keeps the newest
 * loggedAt/updated_at value available.
 *
 * NOTE: This service does NOT import Pinia stores directly to avoid
 * circular dependencies. The stores call sync functions; sync calls
 * Supabase services.
 */

import { isSupabaseEnabled } from './client.js'
import { upsertHabit, deleteHabit, upsertEntry, deleteEntry, bulkUpsertEntries, fetchHabits, fetchEntries } from './habits.service.js'
import { upsertReminderSettings } from './settings.service.js'
import { getUser } from './auth.service.js'
import { storage } from '@services/storage'

// ── Queue storage key ──────────────────────────────────────────────────────
const QUEUE_KEY = 'traker:sync-queue'

// ── Queue helpers ──────────────────────────────────────────────────────────

function readQueue() {
  return storage.read(QUEUE_KEY, [])
}

function writeQueue(q) {
  storage.write(QUEUE_KEY, q)
}

function enqueue(op) {
  const q = readQueue()
  q.push({ ...op, queuedAt: new Date().toISOString() })
  writeQueue(q)
}

function clearQueue() {
  writeQueue([])
}

// ── Online detection ───────────────────────────────────────────────────────

function isOnline() {
  return navigator.onLine
}

/**
 * Register the reconnect handler once when the service initialises.
 * Flushes the queue automatically when network comes back.
 */
let _reconnectRegistered = false

function ensureReconnectListener() {
  if (_reconnectRegistered) return
  _reconnectRegistered = true
  window.addEventListener('online', () => {
    console.info('[sync] Back online — flushing queue…')
    flushQueue().catch(console.warn)
  })
}

// ── Push: local → Supabase ─────────────────────────────────────────────────

/**
 * Push a habit mutation to Supabase.
 * If offline, queues it for later.
 *
 * @param {'upsert-habit' | 'delete-habit' | 'upsert-entry' | 'delete-entry'} type
 * @param {object} payload
 */
export async function push(type, payload) {
  if (!isSupabaseEnabled) return

  ensureReconnectListener()

  if (!isOnline()) {
    enqueue({ type, payload })
    return
  }

  await _execute({ type, payload })
}

async function _execute({ type, payload }) {
  const user = await getUser()
  if (!user) return  // not signed in — push deferred until auth

  try {
    switch (type) {
      case 'upsert-habit':
        await upsertHabit(payload.habit, user.id)
        break

      case 'upsert-entry': {
        const { habitId, day, log } = payload
        await upsertEntry(habitId, day, log)
        break
      }

      case 'delete-habit':
        await deleteHabit(payload.habitId)
        break

      case 'delete-entry':
        await deleteEntry(payload.habitId, payload.day)
        break

      default:
        console.warn('[sync] Unknown operation type:', type)
    }
  } catch (err) {
    console.warn('[sync] Push failed, re-queuing:', err.message)
    enqueue({ type, payload })
  }
}

/**
 * Drain the offline queue, pushing each pending operation to Supabase.
 * Called automatically on reconnect and after sign-in.
 */
export async function flushQueue() {
  if (!isSupabaseEnabled || !isOnline()) return

  const q = readQueue()
  if (!q.length) return

  clearQueue()   // optimistic clear — failed ops re-enqueue themselves

  for (const op of q) {
    await _execute(op)
  }

  console.info(`[sync] Flushed ${q.length} queued operations`)
}

/**
 * Push reminder settings to Supabase so the cron can read them.
 * Fire-and-forget: no-ops when offline / signed out.
 *
 * @param {object} settingsState — settings store state
 */
export async function pushSettings(settingsState) {
  if (!isSupabaseEnabled || !isOnline()) return

  const user = await getUser()
  if (!user) return

  const { error } = await upsertReminderSettings(user.id, settingsState)
  if (error) console.warn('[sync] pushSettings failed:', error.message)
}

// ── Pull: Supabase → local ─────────────────────────────────────────────────

/**
 * Pull all cloud data for the current user and return it in the
 * same shape as the local habits store.
 *
 * The store is responsible for merging / replacing its state —
 * this function only fetches and transforms.
 *
 * @returns {Promise<{ habits: object[] } | null>}
 */
export async function pullAll() {
  if (!isSupabaseEnabled || !isOnline()) return null

  const user = await getUser()
  if (!user) return null

  try {
    const { data: remoteHabits, error: hErr } = await fetchHabits()
    if (hErr) throw hErr

    const habits = await Promise.all(
      (remoteHabits ?? []).map(async (rh) => {
        const { data: entries } = await fetchEntries(rh.id)
        const logs = {}
        for (const e of entries ?? []) {
          logs[e.day_number] = {
            level:   Number(e.status ?? 0),
            emotion: e.emotion ?? null,
            energy:  e.energy  ?? null,
            note:    e.note    ?? '',
            loggedAt: e.updated_at ?? e.created_at ?? null,
          }
        }

        return {
          id:           rh.id,
          name:         rh.title,
          icon:         rh.icon          ?? '🏃',
          color:        rh.color         ?? '#CCFF00',
          duration:     rh.total_days    ?? 30,
          isActive:     rh.is_active     ?? true,
          reminder:     rh.reminder_time ?? null,
          // null still means "unknown" for rows written before migration
          // 003 — mergeFromCloud keeps the local value in that case.
          reminderDays: rh.reminder_days ?? null,
          createdAt:    rh.created_at,
          updatedAt:    rh.updated_at ?? rh.created_at,
          flexDays:     [],
          logs,
        }
      })
    )

    return { habits }
  } catch (err) {
    console.warn('[sync] Pull failed:', err.message)
    return null
  }
}

/**
 * Push ALL local habits to Supabase at once.
 * Used once after the user signs in to seed their cloud account
 * with existing local data.
 *
 * @param {object[]} habits  — from habitsStore.habits
 */
export async function pushAll(habits) {
  if (!isSupabaseEnabled || !isOnline()) return

  const user = await getUser()
  if (!user) return

  for (const habit of habits) {
    const { error: hErr } = await upsertHabit(habit, user.id)
    if (hErr) { console.warn('[sync] pushAll habit failed:', hErr.message); continue }

    if (habit.logs && Object.keys(habit.logs).length) {
      const { error: eErr } = await bulkUpsertEntries(habit.id, habit.logs)
      if (eErr) console.warn('[sync] pushAll entries failed:', eErr.message)
    }
  }

  console.info(`[sync] Pushed ${habits.length} habits to cloud`)
}

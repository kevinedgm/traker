/**
 * @file habits.js
 * Pinia store — habits data + derived computations.
 *
 * Persistence is handled entirely by the persistence plugin.
 * No manual localStorage calls exist in this file.
 *
 * Data shape per habit:
 * {
 *   id, name, icon, color, duration, isActive,
 *   reminder,      // "HH:MM" | null
 *   reminderDays,  // [0-6]   | null
 *   createdAt,     // ISO string
 *   updatedAt,     // ISO string
 *   flexDays,      // number[] — days marked as intentional rest (future: flexible mode)
 *   logs: {
 *     [day: number]: { level: 0-4, emotion: string|null, energy: string|null, note: string }
 *   }
 * }
 *
 * ─── ARCHITECTURE SCAFFOLD (Phase 2+) ─────────────────────────
 * The following features are reserved but not yet implemented:
 *
 *   flexibleMode   — habit-level flag to skip weekends / rest days
 *                    without breaking continuity. Field: flexDays[]
 *
 *   energyTracking — user logs daily energy level (1-5) alongside
 *                    the habit. Field: logs[day].energy (number|null)
 *
 *   insights       — computed patterns from logs: best day-of-week,
 *                    most common emotion, energy correlation.
 *                    All derivable from existing logs shape.
 *
 *   moodContext    — per-entry optional context tag beyond emotion:
 *                    'work', 'travel', 'sick', etc.
 *                    Field: logs[day].context (string|null)
 * ──────────────────────────────────────────────────────────────
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { push } from '@services/supabase/sync.service'

const BUILD_LEVELS = new Set([1, 2, 3])
const CONTINUITY_LEVELS = new Set([1, 2, 3, 4])

function timestamp(value) {
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : 0
}

function normalizeLog(log) {
  return {
    level:    Number(log?.level ?? 0),
    emotion:  log?.emotion  ?? null,
    energy:   log?.energy   ?? null,
    note:     log?.note     ?? '',
    loggedAt: log?.loggedAt ?? new Date().toISOString(),
  }
}

function normalizeHabit(habit) {
  const logs = {}
  for (const [day, log] of Object.entries(habit?.logs ?? {})) {
    logs[day] = normalizeLog(log)
  }

  return {
    id:           habit?.id           ?? crypto.randomUUID(),
    name:         habit?.name         ?? '',
    icon:         habit?.icon         ?? 'Activity',
    color:        habit?.color        ?? '#637f50',
    duration:     habit?.duration     ?? 30,
    isActive:     habit?.isActive     ?? true,
    reminder:     habit?.reminder     ?? null,
    reminderDays: habit?.reminderDays ?? null,
    createdAt:    habit?.createdAt    ?? new Date().toISOString(),
    updatedAt:    habit?.updatedAt    ?? habit?.createdAt ?? new Date().toISOString(),
    flexDays:     habit?.flexDays     ?? [],
    logs,
  }
}

export const useHabitsStore = defineStore(
  'habits',

  () => {
    // ── State ──────────────────────────────────────────────────
    // Starts empty; the persistence plugin hydrates it from storage.
    const habits = ref([])

    // ── Mutations ───────────────────────────────────────────────

    function addHabit({ name, icon, color, duration, reminder, reminderDays }) {
      const now = new Date().toISOString()
      const newHabit = {
        id:           crypto.randomUUID(),
        name:         name.trim(),
        icon,
        color,
        duration,
        isActive:     true,
        reminder:     reminder     ?? null,
        reminderDays: reminderDays ?? null,
        createdAt:    now,
        updatedAt:    now,
        flexDays:     [],   // Phase 2: intentional rest days (flexible mode)
        logs:         {},
      }
      habits.value.push(newHabit)
      // Sync: no-op when offline or not signed in; plugin persists to localStorage
      push('upsert-habit', { habit: newHabit })
    }

    function removeHabit(id) {
      habits.value = habits.value.filter(h => h.id !== id)
      push('delete-habit', { habitId: id })
    }

    /**
     * Update editable fields of a habit.
     * Duration may shrink; logs outside the new range are kept and simply hidden.
     */
    function updateHabit(id, { name, icon, color, duration, reminder, reminderDays, isActive }) {
      const habit = habits.value.find(h => h.id === id)
      if (!habit) return
      if (name         !== undefined) habit.name         = name.trim()
      if (icon         !== undefined) habit.icon         = icon
      if (color        !== undefined) habit.color        = color
      if (duration     !== undefined) habit.duration     = Math.max(1, Number(duration) || habit.duration)
      if (reminder     !== undefined) habit.reminder     = reminder
      if (reminderDays !== undefined) habit.reminderDays = reminderDays
      if (isActive     !== undefined) habit.isActive     = Boolean(isActive)
      habit.updatedAt = new Date().toISOString()
      push('upsert-habit', { habit })
    }

    /**
     * Log (or overwrite) a single day's entry.
     * `day` is a 1-based sequential number.
     */
    function logDay(habitId, day, { level, emotion, energy, note }) {
      const habit = habits.value.find(h => h.id === habitId)
      if (!habit) return
      if (!habit.logs) habit.logs = {}
      const now = new Date().toISOString()
      habit.logs[day] = {
        level,
        emotion:  emotion  ?? null,
        energy:   energy   ?? null,
        note:     note     ?? '',
        loggedAt: now,
      }
      habit.updatedAt = now
      push('upsert-entry', {
        habitId,
        day,
        log: { level, emotion: emotion ?? null, energy: energy ?? null, note: note ?? '', loggedAt: now },
      })
    }

    /** Remove a single day's log entry. */
    function clearDay(habitId, day) {
      const habit = habits.value.find(h => h.id === habitId)
      if (!habit?.logs) return
      delete habit.logs[day]
      habit.updatedAt = new Date().toISOString()
      push('delete-entry', { habitId, day })
    }

    /**
     * Merge cloud habits into local state without clearing local-only data.
     * This preserves the offline-first contract while enabling multi-device sync.
     */
    function mergeFromCloud(cloudHabits = []) {
      for (const incomingRaw of cloudHabits) {
        const incoming = normalizeHabit(incomingRaw)
        const local = habits.value.find(h => h.id === incoming.id)

        if (!local) {
          habits.value.push(incoming)
          continue
        }

        const localUpdated = timestamp(local.updatedAt ?? local.createdAt)
        const cloudUpdated = timestamp(incoming.updatedAt ?? incoming.createdAt)

        if (cloudUpdated > localUpdated) {
          local.name         = incoming.name
          local.icon         = incoming.icon
          local.color        = incoming.color
          local.duration     = incoming.duration
          local.isActive     = incoming.isActive
          local.reminder     = incoming.reminder
          local.reminderDays = incoming.reminderDays
          local.updatedAt    = incoming.updatedAt
        }

        if (!local.logs) local.logs = {}
        for (const [day, cloudLog] of Object.entries(incoming.logs ?? {})) {
          const localLog = local.logs[day]
          if (!localLog || timestamp(cloudLog.loggedAt) >= timestamp(localLog.loggedAt)) {
            local.logs[day] = normalizeLog(cloudLog)
          }
        }
      }
    }

    // ── Derived / queries ────────────────────────────────────────

    /**
     * Returns the sequential day number (1-based) for today.
     * Day 1 = creation date. Capped at habit.duration.
     */
    function getCurrentDay(habit) {
      if (!habit?.createdAt) return 1
      const created = new Date(habit.createdAt)
      const today   = new Date()
      created.setHours(0, 0, 0, 0)
      today.setHours(0, 0, 0, 0)
      const diff = Math.floor((today - created) / 86_400_000)
      return Math.min(Math.max(diff + 1, 1), habit.duration)
    }

    /** Count of days that actively build progress: mínimo, bien, excelente. */
    function getCompletedDays(habit) {
      return Object.values(habit.logs ?? {}).filter(l => BUILD_LEVELS.has(l.level)).length
    }

    /**
     * ADHD-first primary metric: days actively built.
     * Semantically identical to getCompletedDays but named for the
     * "días construidos" philosophy (never resets, only grows).
     */
    function getBuiltDays(habit) {
      return getCompletedDays(habit)
    }

    /**
     * Count of all days that have any log entry (any level, incl. 0).
     * Useful for "X días registrados" — rewards showing up, not just
     * performing. A level-0 "no realizado" still counts as engagement.
     */
    function getRegisteredDays(habit) {
      return Object.keys(habit.logs ?? {}).length
    }

    /**
     * Progress percentage: completedDays / duration × 100.
     * Answers "how much of the full challenge have you completed?"
     * Capped at 100.
     */
    function getProgress(habit) {
      const duration = habit?.duration
      if (!duration || duration <= 0) return 0
      return Math.min(Math.round((getCompletedDays(habit) / duration) * 100), 100)
    }

    /**
     * Consistency rate: completedDays / currentDay × 100.
     * Answers "of the days that have elapsed, how many did you build?"
     * Useful for soft continuity indicators and detail views.
     */
    function getConsistency(habit) {
      const current = getCurrentDay(habit)
      if (current <= 0) return 0
      return Math.min(Math.round((getCompletedDays(habit) / current) * 100), 100)
    }

    /**
     * Consecutive days that preserve continuity.
     * Flexible days maintain continuity but do not add progress.
     */
    function getStreak(habit) {
      const current = getCurrentDay(habit)
      let streak = 0
      for (let d = current; d >= 1; d--) {
        const log = habit.logs?.[d]
        if (log && CONTINUITY_LEVELS.has(log.level)) streak++
        else break
      }
      return streak
    }

    /** True if the habit's duration has been fully elapsed. */
    function isCompleted(habit) {
      return getCurrentDay(habit) >= habit.duration
    }

    return {
      habits,
      addHabit,
      removeHabit,
      updateHabit,
      mergeFromCloud,
      logDay,
      clearDay,
      getCurrentDay,
      getCompletedDays,
      getBuiltDays,
      getRegisteredDays,
      getProgress,
      getConsistency,
      getStreak,
      isCompleted,
    }
  },

  // ── Persistence config ─────────────────────────────────────────
  {
    persist: {
      key:  'traker:habits',
      pick: ['habits'],

      /**
       * Serialize: ensure every habit has all required fields before
       * writing. Acts as a runtime schema enforcement.
       */
      serialize(state) {
        return {
          habits: state.habits.map(h => ({
            id:           h.id,
            name:         h.name         ?? '',
            icon:         h.icon         ?? 'Activity',
            color:        h.color        ?? '#637f50',
            duration:     h.duration     ?? 30,
            isActive:     h.isActive     ?? true,
            reminder:     h.reminder     ?? null,
            reminderDays: h.reminderDays ?? null,
            createdAt:    h.createdAt    ?? new Date().toISOString(),
            updatedAt:    h.updatedAt    ?? h.createdAt ?? new Date().toISOString(),
            flexDays:     h.flexDays     ?? [],
            logs:         h.logs         ?? {},
          })),
        }
      },

      /**
       * Deserialize: handle both the old bare-array format and the
       * new { habits: [...] } format. Fill in any missing fields so
       * old data doesn't crash the app.
       */
      deserialize(saved) {
        const raw = Array.isArray(saved)
          ? saved                       // old format: bare array
          : (saved?.habits ?? [])       // new format: { habits: [...] }

        return { habits: raw.map(normalizeHabit) }
      },
    },
  }
)

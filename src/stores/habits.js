/**
 * @file habits.js
 * Pinia store — habits data + derived computations.
 *
 * Persistence is handled entirely by the persistence plugin.
 * No manual localStorage calls exist in this file.
 *
 * Data shape per habit:
 * {
 *   id, name, minimumVersion, icon, color, duration, isActive,
 *   goalId,        // optional local/cloud-safe link to a goal
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
import { DEFAULT_HABIT_COLOR, normalizeHabitColor, PALETTE } from '@utils/colors'
import {
  dayNumberForLocalDate,
  isHabitScheduledForDate,
  localDateKey,
  normalizeGoalIds,
  normalizeHabitLog,
  normalizeHabitSchedule,
} from '@/features/habits/domain.js'

const BUILD_LEVELS = new Set([1, 2, 3])
const CONTINUITY_LEVELS = new Set([1, 2, 3, 4])
export const MIN_HABIT_DURATION = 1
export const MAX_HABIT_DURATION = 365

export function normalizeHabitDuration(value, fallback = 30) {
  const parsed = Number.parseInt(value, 10)
  const safeFallback = Number.parseInt(fallback, 10) || 30
  return Math.min(MAX_HABIT_DURATION, Math.max(MIN_HABIT_DURATION, Number.isFinite(parsed) ? parsed : safeFallback))
}

function timestamp(value) {
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : 0
}

function normalizeHabit(habit) {
  const createdAt = habit?.createdAt ?? new Date().toISOString()
  const goalIds = normalizeGoalIds(habit?.goalIds, habit?.goalId)
  const normalized = {
    id:           habit?.id           ?? crypto.randomUUID(),
    name:         habit?.name         ?? '',
    minimumVersion: habit?.minimumVersion ?? '',
    goalId:       goalIds[0] ?? null,
    goalIds,
    icon:         habit?.icon         ?? 'Activity',
    color:        normalizeHabitColor(habit?.color),
    duration:     normalizeHabitDuration(habit?.duration),
    isActive:     habit?.isActive     ?? true,
    lifecycleStatus: habit?.lifecycleStatus ?? (habit?.isActive === false ? 'paused' : 'active'),
    version:      Math.max(1, Number(habit?.version) || 1),
    reminder:     habit?.reminder     ?? null,
    reminderDays: habit?.reminderDays ?? null,
    createdAt,
    updatedAt:    habit?.updatedAt    ?? createdAt,
    flexDays:     habit?.flexDays     ?? [],
    // Copy/personality override — see src/features/copy/. Kept as an opaque
    // object here (no domain logic on it); null = use global defaults.
    copySettings: habit?.copySettings ?? null,
    schedule:     normalizeHabitSchedule(habit?.schedule, habit?.reminderDays, createdAt),
    logs:         {},
  }
  for (const [day, log] of Object.entries(habit?.logs ?? {})) {
    normalized.logs[day] = normalizeHabitLog(log, { habit: normalized, day: Number(day) })
  }
  return normalized
}

/**
 * Repairs the short-lived migration that collapsed every custom color to the
 * purple fallback. It only runs when an entire multi-habit collection has the
 * exact fallback, so ordinary color choices remain untouched.
 */
export function restoreCollapsedHabitColors(habits) {
  if (habits.length < 2 || !habits.every(habit => habit.color === DEFAULT_HABIT_COLOR)) return habits
  return habits.map((habit, index) => ({
    ...habit,
    color: PALETTE[index % PALETTE.length].value,
  }))
}

export const useHabitsStore = defineStore(
  'habits',

  () => {
    // ── State ──────────────────────────────────────────────────
    // Starts empty; the persistence plugin hydrates it from storage.
    const habits = ref([])

    // ── Mutations ───────────────────────────────────────────────

    function addHabit({ name, minimumVersion, goalId, goalIds, icon, color, duration, reminder, reminderDays, schedule, copySettings }) {
      const now = new Date().toISOString()
      const linkedGoalIds = normalizeGoalIds(goalIds, goalId)
      const newHabit = normalizeHabit({
        id:           crypto.randomUUID(),
        name:         name.trim(),
        minimumVersion: String(minimumVersion ?? '').trim(),
        goalId:       linkedGoalIds[0] ?? null,
        goalIds:      linkedGoalIds,
        icon,
        color: normalizeHabitColor(color),
        duration: normalizeHabitDuration(duration),
        isActive:     true,
        lifecycleStatus: 'active',
        version:      1,
        reminder:     reminder     ?? null,
        reminderDays: reminderDays ?? null,
        schedule:     normalizeHabitSchedule(schedule, reminderDays, now),
        createdAt:    now,
        updatedAt:    now,
        flexDays:     [],   // Phase 2: intentional rest days (flexible mode)
        copySettings: copySettings ?? null,
        logs:         {},
      })
      habits.value.push(newHabit)
      // Sync: no-op when offline or not signed in; plugin persists to localStorage
      push('upsert-habit', { habit: newHabit })
      return newHabit
    }

    function removeHabit(id) {
      const habit = habits.value.find(h => h.id === id)
      habits.value = habits.value.filter(h => h.id !== id)
      push('delete-habit', {
        habitId: id,
        baseVersion: habit?.version ?? 0,
        habit,
      })
    }

    function clearAllHabits() {
      const removed = habits.value.map(habit => ({
        habitId: habit.id,
        baseVersion: habit.version ?? 0,
        habit,
      }))
      habits.value = []
      for (const payload of removed) push('delete-habit', payload)
    }

    /**
     * Update editable fields of a habit.
     * Duration may shrink; logs outside the new range are kept and simply hidden.
     */
    function updateHabit(id, { name, minimumVersion, goalId, goalIds, icon, color, duration, reminder, reminderDays, schedule, isActive, copySettings }) {
      const habit = habits.value.find(h => h.id === id)
      if (!habit) return
      if (name         !== undefined) habit.name         = name.trim()
      if (minimumVersion !== undefined) habit.minimumVersion = String(minimumVersion).trim()
      if (goalIds !== undefined || goalId !== undefined) {
        habit.goalIds = normalizeGoalIds(goalIds, goalId)
        habit.goalId = habit.goalIds[0] ?? null
      }
      if (icon         !== undefined) habit.icon         = icon
      if (color        !== undefined) habit.color        = normalizeHabitColor(color)
      if (duration     !== undefined) habit.duration     = normalizeHabitDuration(duration, habit.duration)
      if (reminder     !== undefined) habit.reminder     = reminder
      if (reminderDays !== undefined) habit.reminderDays = reminderDays
      if (schedule !== undefined) {
        const nextSchedule = normalizeHabitSchedule(schedule, reminderDays ?? habit.reminderDays, habit.createdAt)
        nextSchedule.version = Math.max(1, Number(habit.schedule?.version) || 1) + 1
        habit.schedule = nextSchedule
      }
      if (isActive     !== undefined) {
        habit.isActive = Boolean(isActive)
        habit.lifecycleStatus = habit.isActive ? 'active' : 'paused'
      }
      if (copySettings !== undefined) habit.copySettings = copySettings
      habit.updatedAt = new Date().toISOString()
      habit.version = Math.max(1, Number(habit.version) || 1) + 1
      push('upsert-habit', { habit })
    }

    /**
     * Log (or overwrite) a single day's entry.
     * `day` is a 1-based sequential number.
     */
    function logDay(habitId, day, input = {}) {
      const habit = habits.value.find(h => h.id === habitId)
      if (!habit) return
      if (!habit.logs) habit.logs = {}
      const now = new Date().toISOString()
      const existing = habit.logs[day]
      const nextInput = {
        ...existing,
        ...input,
        emotion: input.emotion ?? existing?.emotion ?? null,
        energy: input.energy ?? existing?.energy ?? null,
        note: input.note ?? existing?.note ?? '',
        loggedAt: now,
        version: existing ? (Number(existing.version) || 1) + 1 : 1,
      }
      // Callers using the legacy numeric contract must be able to replace a
      // previously canonical record, and vice versa. Never let stale fields
      // override the explicitly supplied representation.
      if (Object.hasOwn(input, 'status')) delete nextInput.level
      else if (Object.hasOwn(input, 'level')) {
        delete nextInput.status
        delete nextInput.minimumUsed
      }
      habit.logs[day] = normalizeHabitLog(nextInput, { habit, day })
      push('upsert-entry', {
        habitId,
        day,
        log: habit.logs[day],
      })
    }

    /** Remove a single day's log entry. */
    function clearDay(habitId, day) {
      const habit = habits.value.find(h => h.id === habitId)
      if (!habit?.logs) return
      const log = habit.logs[day]
      delete habit.logs[day]
      push('delete-entry', { habitId, day, log })
    }

    /**
     * Merge cloud habits into local state without clearing local-only data.
     * This preserves the offline-first contract while enabling multi-device sync.
     */
    function mergeFromCloud(cloudHabits = [], { preferCloud = false } = {}) {
      for (const incomingRaw of cloudHabits) {
        const incoming = normalizeHabit(incomingRaw)
        const local = habits.value.find(h => h.id === incoming.id)

        if (!local) {
          habits.value.push(incoming)
          continue
        }

        const localUpdated = timestamp(local.updatedAt ?? local.createdAt)
        const cloudUpdated = timestamp(incoming.updatedAt ?? incoming.createdAt)
        const localVersion = Math.max(1, Number(local.version) || 1)
        const cloudVersion = Math.max(1, Number(incoming.version) || 1)
        const cloudHabitWins = preferCloud
          || cloudVersion > localVersion
          || (cloudVersion === localVersion && cloudUpdated > localUpdated)

        if (cloudHabitWins) {
          local.name         = incoming.name
          local.minimumVersion = incoming.minimumVersion || local.minimumVersion || ''
          local.goalId       = incoming.goalId
          local.goalIds      = incoming.goalIds
          local.icon         = incoming.icon
          local.color        = incoming.color
          local.duration     = incoming.duration
          local.isActive     = incoming.isActive
          local.lifecycleStatus = incoming.lifecycleStatus
          local.version      = incoming.version
          local.reminder     = incoming.reminder
          // Cloud can't store reminderDays yet (no column until migration
          // 003) — a null from the cloud means "unknown", not "cleared",
          // so never wipe the locally configured days with it.
          local.reminderDays = incoming.reminderDays ?? local.reminderDays
          local.schedule     = incoming.schedule ?? local.schedule
          local.copySettings = incoming.copySettings ?? local.copySettings
          local.updatedAt    = incoming.updatedAt
        }

        if (!local.logs) local.logs = {}
        for (const [day, cloudLog] of Object.entries(incoming.logs ?? {})) {
          const localLog = local.logs[day]
          const localLogVersion = Math.max(1, Number(localLog?.version) || 1)
          const cloudLogVersion = Math.max(1, Number(cloudLog?.version) || 1)
          const cloudLogWins = !localLog
            || cloudLogVersion > localLogVersion
            || (cloudLogVersion === localLogVersion
              && timestamp(cloudLog.loggedAt) >= timestamp(localLog.loggedAt))
          if (cloudLogWins) {
            local.logs[day] = normalizeHabitLog(cloudLog, { habit: local, day: Number(day) })
          }
        }
      }
    }

    /** Apply content-free v2 delete signals after the owner-scoped cloud pull. */
    function applyV2Changes(changes = []) {
      for (const change of changes) {
        if (change?.result !== 'applied' || change?.operationType !== 'delete') continue
        if (change.entityType === 'habit') {
          habits.value = habits.value.filter(habit => habit.id !== change.entityId)
          continue
        }
        if (change.entityType !== 'habitLog') continue
        for (const habit of habits.value) {
          if (!habit.logs) continue
          const day = Object.keys(habit.logs).find(key => habit.logs[key]?.id === change.entityId)
          if (day !== undefined) delete habit.logs[day]
        }
      }
    }

    async function restoreHabitFromPilot(snapshot) {
      if (!snapshot?.id || !snapshot.deletedAt) return { status: 'unavailable' }
      const now = new Date().toISOString()
      const baseVersion = Math.max(0, Number(snapshot.version) || 0)
      const restored = normalizeHabit({
        ...snapshot,
        isActive: true,
        lifecycleStatus: 'active',
        version: baseVersion + 1,
        updatedAt: now,
      })
      delete restored.deletedAt
      const result = await push('restore-habit', { habit: restored, baseVersion })
      if (result?.status !== 'synced') return result
      const index = habits.value.findIndex(habit => habit.id === restored.id)
      if (index < 0) habits.value.push(restored)
      else habits.value[index] = restored
      return result
    }

    // ── Derived / queries ────────────────────────────────────────

    /**
     * Returns the sequential day number (1-based) for today.
     * Day 1 = creation date. Capped at habit.duration.
     */
    function getCurrentDay(habit) {
      if (!habit?.createdAt) return 1
      const timezone = habit.schedule?.timezone
      const day = dayNumberForLocalDate(habit.createdAt, localDateKey(new Date(), timezone), timezone)
      return Math.min(day, habit.duration)
    }

    function isScheduledForDate(habit, date = new Date()) {
      return isHabitScheduledForDate(habit, date)
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
      clearAllHabits,
      updateHabit,
      mergeFromCloud,
      applyV2Changes,
      restoreHabitFromPilot,
      logDay,
      clearDay,
      getCurrentDay,
      isScheduledForDate,
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
            minimumVersion: h.minimumVersion ?? '',
            goalId:       h.goalIds?.[0] ?? h.goalId ?? null,
            goalIds:      normalizeGoalIds(h.goalIds, h.goalId),
            icon:         h.icon         ?? 'Activity',
            color:        normalizeHabitColor(h.color),
            duration:     normalizeHabitDuration(h.duration),
            isActive:     h.isActive     ?? true,
            lifecycleStatus: h.lifecycleStatus ?? (h.isActive === false ? 'paused' : 'active'),
            version:      Math.max(1, Number(h.version) || 1),
            reminder:     h.reminder     ?? null,
            reminderDays: h.reminderDays ?? null,
            schedule:     normalizeHabitSchedule(h.schedule, h.reminderDays, h.createdAt),
            createdAt:    h.createdAt    ?? new Date().toISOString(),
            updatedAt:    h.updatedAt    ?? h.createdAt ?? new Date().toISOString(),
            flexDays:     h.flexDays     ?? [],
            copySettings: h.copySettings ?? null,
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

        return { habits: restoreCollapsedHabitColors(raw.map(normalizeHabit)) }
      },
    },
  }
)

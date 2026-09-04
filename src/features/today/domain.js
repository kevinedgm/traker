import {
  currentTimezone,
  dayNumberForLocalDate,
  isHabitScheduledForDate,
  localDateKey,
} from '@/features/habits/domain.js'
import { summarizeFlexibleGroups } from '@/features/flexibleGroups/domain.js'

const BUILT_LEVELS = new Set([1, 2, 3])

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const random = Math.floor(Math.random() * 16)
      return (token === 'x' ? random : ((random & 0x3) | 0x8)).toString(16)
    })
}

export function summarizeDay(habits = [], value = new Date(), options = {}) {
  const excludedHabitIds = options.excludedHabitIds instanceof Set
    ? options.excludedHabitIds
    : new Set(options.excludedHabitIds ?? [])
  const scheduled = habits.filter(habit => !excludedHabitIds.has(habit.id) && isHabitScheduledForDate(habit, value))
  const entries = scheduled.map(habit => {
    const timezone = habit.schedule?.timezone ?? currentTimezone()
    const date = localDateKey(value, timezone)
    const day = dayNumberForLocalDate(habit.createdAt, date, timezone)
    return { habit, day, log: habit.logs?.[day] ?? null }
  })
  const registered = entries.filter(entry => entry.log).length
  const built = entries.filter(entry => BUILT_LEVELS.has(Number(entry.log?.level))).length
  const complete = entries.filter(entry => Number(entry.log?.level) === 3).length
  const adapted = entries.filter(entry => [1, 2].includes(Number(entry.log?.level))).length
  const consciousSkips = entries.filter(entry => Number(entry.log?.level) === 4).length
  const notDone = entries.filter(entry => Number(entry.log?.level) === 0).length
  const isSufficient = built === entries.length
  const flexibleGroups = summarizeFlexibleGroups(options.flexibleGroups ?? [], habits, value)

  return {
    localDate: localDateKey(value),
    scheduled: entries.length,
    registered,
    built,
    complete,
    adapted,
    consciousSkips,
    notDone,
    unregistered: Math.max(0, entries.length - registered),
    isSufficient,
    state: isSufficient ? 'sufficient' : built > 0 ? 'moved' : 'quiet',
    entries,
    flexibleGroups,
  }
}

export function normalizeDayClosure(closure = {}, summary = null) {
  const now = closure.closedAt ?? new Date().toISOString()
  const resolvedSummary = summary ?? closure.summary ?? {}
  const status = ['sufficient', 'moved', 'quiet'].includes(closure.status)
    ? closure.status
    : resolvedSummary.state ?? 'quiet'
  return {
    id: closure.id ?? randomId(),
    localDate: closure.localDate ?? resolvedSummary.localDate ?? localDateKey(now),
    timezone: closure.timezone ?? currentTimezone(),
    status,
    summary: {
      scheduled: Math.max(0, Number(resolvedSummary.scheduled) || 0),
      registered: Math.max(0, Number(resolvedSummary.registered) || 0),
      built: Math.max(0, Number(resolvedSummary.built) || 0),
      complete: Math.max(0, Number(resolvedSummary.complete) || 0),
      adapted: Math.max(0, Number(resolvedSummary.adapted) || 0),
      flexibleGroups: Array.isArray(resolvedSummary.flexibleGroups)
        ? resolvedSummary.flexibleGroups.map(group => ({
          id: group.id,
          name: String(group.name ?? '').slice(0, 120),
          period: group.period === 'month' ? 'month' : 'week',
          built: Math.max(0, Number(group.built) || 0),
          minimum: Math.max(1, Number(group.minimum) || 1),
          remaining: Math.max(0, Number(group.remaining) || 0),
          isMinimumMet: Boolean(group.isMinimumMet),
        }))
        : [],
    },
    tomorrowNote: String(closure.tomorrowNote ?? '').trim().slice(0, 240),
    closedAt: now,
    updatedAt: closure.updatedAt ?? now,
    version: Math.max(1, Number(closure.version) || 1),
  }
}

export function closureCopy(summary) {
  if (Number(summary?.scheduled) === 0) {
    return {
      title: 'Hoy no hay mínimos programados.',
      body: 'Puedes cerrar suficiente o elegir algo opcional. Mañana empieza sin deuda.',
    }
  }
  if (summary?.isSufficient || summary?.state === 'sufficient') {
    return {
      title: 'Hoy fue suficiente.',
      body: 'Moviste los mínimos que elegiste. Lo demás no se convierte en deuda.',
    }
  }
  if (Number(summary?.built) > 0) {
    return {
      title: 'Lo que sí pasó queda guardado.',
      body: 'Hubo movimiento, aunque el día no quedara completo. Mañana empieza sin deuda.',
    }
  }
  return {
    title: 'Hoy no se movió. Y eso también se puede cerrar.',
    body: 'No necesitas recuperar este día ni explicar por qué. Mañana podrás elegir de nuevo.',
  }
}

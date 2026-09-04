import {
  currentTimezone,
  localDateForDay,
  localDateKey,
} from '@/features/habits/domain.js'

const BUILT_LEVELS = new Set([1, 2, 3])
const PERIODS = new Set(['week', 'month'])
const STATUSES = new Set(['active', 'paused', 'archived'])

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const random = Math.floor(Math.random() * 16)
      return (token === 'x' ? random : ((random & 0x3) | 0x8)).toString(16)
    })
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)
  return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback))
}

function safeTimezone(value) {
  const candidate = String(value ?? '').trim() || currentTimezone()
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: candidate }).format()
    return candidate
  } catch {
    return currentTimezone()
  }
}

export function normalizeFlexibleGroup(input = {}) {
  const now = new Date().toISOString()
  const memberIds = [...new Set((input.memberIds ?? input.habitIds ?? [])
    .map(id => String(id ?? '').trim())
    .filter(Boolean))]
  const maximum = Math.max(1, memberIds.length || 99)
  const minimumCount = boundedInteger(input.minimumCount, 1, 1, maximum)
  const targetCount = boundedInteger(input.targetCount, minimumCount, minimumCount, maximum)
  const extraCount = boundedInteger(input.extraCount, targetCount, targetCount, maximum)

  return {
    id: input.id ?? randomId(),
    name: String(input.name ?? '').trim().slice(0, 120),
    period: PERIODS.has(input.period) ? input.period : 'week',
    minimumCount,
    targetCount,
    extraCount,
    timezone: safeTimezone(input.timezone),
    status: STATUSES.has(input.status)
      ? input.status
      : input.enabled === false ? 'paused' : 'active',
    memberIds,
    version: Math.max(1, Number(input.version) || 1),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? input.createdAt ?? now,
    deletedAt: input.deletedAt ?? null,
  }
}

function utcDate(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`)
}

export function flexiblePeriodBounds(groupInput, value = new Date()) {
  const group = normalizeFlexibleGroup(groupInput)
  const date = localDateKey(value, group.timezone)
  if (group.period === 'month') {
    const [year, month] = date.split('-').map(Number)
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    }
  }
  const current = utcDate(date)
  const mondayOffset = (current.getUTCDay() + 6) % 7
  const start = new Date(current)
  start.setUTCDate(start.getUTCDate() - mondayOffset)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    key: start.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function logDate(habit, day, log, timezone) {
  return log?.localDate ?? localDateForDay(habit.createdAt, Number(day), timezone)
}

export function flexibleGroupProgress(groupInput, habits = [], value = new Date()) {
  const group = normalizeFlexibleGroup(groupInput)
  const bounds = flexiblePeriodBounds(group, value)
  const members = new Set(group.memberIds)
  const completedHabitIds = new Set()

  for (const habit of habits) {
    if (!members.has(habit.id) || habit.isActive === false) continue
    const timezone = habit.schedule?.timezone ?? group.timezone
    const built = Object.entries(habit.logs ?? {}).some(([day, log]) => {
      if (!BUILT_LEVELS.has(Number(log?.level))) return false
      const date = logDate(habit, day, log, timezone)
      return date >= bounds.start && date <= bounds.end
    })
    if (built) completedHabitIds.add(habit.id)
  }

  const built = completedHabitIds.size
  return {
    id: group.id,
    name: group.name,
    period: group.period,
    periodKey: bounds.key,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    minimum: group.minimumCount,
    target: group.targetCount,
    extra: group.extraCount,
    built,
    remaining: Math.max(0, group.minimumCount - built),
    isMinimumMet: built >= group.minimumCount,
    completedHabitIds: [...completedHabitIds],
  }
}

export function summarizeFlexibleGroups(groups = [], habits = [], value = new Date()) {
  return groups
    .map(normalizeFlexibleGroup)
    .filter(group => group.status === 'active' && !group.deletedAt && group.memberIds.length)
    .map(group => flexibleGroupProgress(group, habits, value))
}

export function buildFlexibleAgenda(groups = [], habits = [], value = new Date()) {
  const activeGroups = groups
    .map(normalizeFlexibleGroup)
    .filter(group => group.status === 'active' && !group.deletedAt && group.memberIds.length)
  const memberIds = new Set(activeGroups.flatMap(group => group.memberIds))
  const groupNamesByHabit = new Map()
  for (const group of activeGroups) {
    for (const habitId of group.memberIds) {
      const names = groupNamesByHabit.get(habitId) ?? []
      names.push(group.name)
      groupNamesByHabit.set(habitId, names)
    }
  }
  const options = habits
    .filter(habit => memberIds.has(habit.id) && habit.isActive !== false)
    .map(habit => ({ habit, groupNames: groupNamesByHabit.get(habit.id) ?? [] }))
    .sort((a, b) => String(a.habit.name).localeCompare(String(b.habit.name), 'es'))

  return {
    groups: activeGroups.map(group => flexibleGroupProgress(group, habits, value)),
    options,
    memberIds,
  }
}

export function flexiblePeriodLabel(period) {
  return period === 'month' ? 'este mes' : 'esta semana'
}

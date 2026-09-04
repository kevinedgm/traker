export const DEFAULT_HABIT_TIMEZONE = 'America/Mexico_City'
export const DEFAULT_SCHEDULE_DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 0])
export const HABIT_SCHEDULE_KINDS = Object.freeze([
  'weekdays',
  'times_per_week',
  'times_per_month',
  'every_n_days',
  'window',
])

const WEEK_ORDER = new Map(DEFAULT_SCHEDULE_DAYS.map((day, index) => [day, index]))
const BUILD_LEVELS = new Set([1, 2, 3])
const PERIOD_MAXIMUM = Object.freeze({ times_per_week: 7, times_per_month: 31 })
const LOG_STATUS_BY_LEVEL = Object.freeze({
  0: 'not_done',
  1: 'partial',
  2: 'partial',
  3: 'done',
  4: 'conscious_skip',
})
const LOG_LEVEL_BY_STATUS = Object.freeze({
  not_done: 0,
  partial: 2,
  done: 3,
  conscious_skip: 4,
})
const LOG_STATUSES = new Set(Object.keys(LOG_LEVEL_BY_STATUS))

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const random = Math.floor(Math.random() * 16)
      return (token === 'x' ? random : ((random & 0x3) | 0x8)).toString(16)
    })
}

export function currentTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_HABIT_TIMEZONE
  } catch {
    return DEFAULT_HABIT_TIMEZONE
  }
}

function safeTimezone(value) {
  const candidate = String(value ?? '').trim() || DEFAULT_HABIT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format()
    return candidate
  } catch {
    return DEFAULT_HABIT_TIMEZONE
  }
}

export function normalizeScheduleDays(days, fallback = DEFAULT_SCHEDULE_DAYS) {
  const source = Array.isArray(days) && days.length ? days : fallback
  return [...new Set(source
    .map(Number)
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => WEEK_ORDER.get(a) - WEEK_ORDER.get(b))
}

export function normalizeGoalIds(goalIds, legacyGoalId = null) {
  const source = Array.isArray(goalIds) ? goalIds : (legacyGoalId ? [legacyGoalId] : [])
  return [...new Set(source
    .map(value => String(value ?? '').trim())
    .filter(Boolean))]
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)
  const resolved = Number.isFinite(parsed) ? parsed : fallback
  return Math.min(maximum, Math.max(minimum, resolved))
}

function normalizeTime(value, fallback) {
  const candidate = String(value ?? '').trim().slice(0, 5)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : fallback
}

function normalizePeriodTargets(schedule, kind) {
  if (!PERIOD_MAXIMUM[kind]) {
    return { periodMinimum: null, periodTarget: null, periodExtra: null }
  }
  const maximum = PERIOD_MAXIMUM[kind]
  const defaultMinimum = kind === 'times_per_week' ? 3 : 12
  const minimum = boundedInteger(schedule?.periodMinimum, defaultMinimum, 1, maximum)
  const target = boundedInteger(schedule?.periodTarget, minimum, minimum, maximum)
  const extra = boundedInteger(schedule?.periodExtra, target, target, maximum)
  return { periodMinimum: minimum, periodTarget: target, periodExtra: extra }
}

export function normalizeHabitSchedule(schedule, fallbackDays, createdAt = new Date().toISOString()) {
  const timezone = safeTimezone(schedule?.timezone ?? currentTimezone())
  const kind = HABIT_SCHEDULE_KINDS.includes(schedule?.kind) ? schedule.kind : 'weekdays'
  const targets = normalizePeriodTargets(schedule, kind)
  return {
    id: schedule?.id ?? randomId(),
    kind,
    timezone,
    daysOfWeek: kind === 'weekdays'
      ? normalizeScheduleDays(schedule?.daysOfWeek ?? fallbackDays)
      : null,
    intervalDays: kind === 'every_n_days'
      ? boundedInteger(schedule?.intervalDays, 2, 1, 366)
      : null,
    ...targets,
    windowStart: kind === 'window' ? normalizeTime(schedule?.windowStart, '08:00') : null,
    windowEnd: kind === 'window' ? normalizeTime(schedule?.windowEnd, '20:00') : null,
    effectiveFrom: schedule?.effectiveFrom ?? localDateKey(createdAt, timezone),
    effectiveTo: schedule?.effectiveTo ?? null,
    isActive: schedule?.isActive ?? true,
    version: Math.max(1, Number(schedule?.version) || 1),
  }
}

export function localDateKey(value = new Date(), timezone = currentTimezone()) {
  const date = value instanceof Date ? value : new Date(value)
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(safeDate)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dateKeyToUtc(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function dateKeyDistance(from, to) {
  return Math.floor((dateKeyToUtc(to) - dateKeyToUtc(from)) / 86_400_000)
}

function periodStartDateKey(dateKey, kind) {
  if (kind === 'times_per_month') return `${dateKey.slice(0, 8)}01`
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  return new Date(dateKeyToUtc(dateKey) - mondayOffset * 86_400_000).toISOString().slice(0, 10)
}

function periodEndDateKey(dateKey, kind) {
  if (kind === 'times_per_month') {
    const [year, month] = dateKey.split('-').map(Number)
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  }
  return new Date(dateKeyToUtc(periodStartDateKey(dateKey, kind)) + 6 * 86_400_000).toISOString().slice(0, 10)
}

export function localDateForDay(createdAt, day, timezone = currentTimezone()) {
  const start = dateKeyToUtc(localDateKey(createdAt, timezone))
  const offset = Math.max(0, Number(day) - 1) * 86_400_000
  return new Date(start + offset).toISOString().slice(0, 10)
}

export function dayNumberForLocalDate(createdAt, localDate, timezone = currentTimezone()) {
  const start = dateKeyToUtc(localDateKey(createdAt, timezone))
  const target = dateKeyToUtc(localDate)
  return Math.max(1, Math.floor((target - start) / 86_400_000) + 1)
}

export function scheduleProgressForDate(habit, value = new Date()) {
  const schedule = normalizeHabitSchedule(habit?.schedule, habit?.reminderDays, habit?.createdAt)
  if (!PERIOD_MAXIMUM[schedule.kind]) return null
  const dateKey = localDateKey(value, schedule.timezone)
  const periodStart = periodStartDateKey(dateKey, schedule.kind)
  const periodEnd = periodEndDateKey(dateKey, schedule.kind)
  const countFrom = schedule.effectiveFrom && schedule.effectiveFrom > periodStart
    ? schedule.effectiveFrom
    : periodStart
  const builtDates = new Set(Object.values(habit?.logs ?? {})
    .filter(log => BUILD_LEVELS.has(Number(log?.level)))
    .map(log => log?.localDate)
    .filter(logDate => logDate && logDate >= countFrom && logDate <= periodEnd))
  return {
    kind: schedule.kind,
    periodStart,
    periodEnd,
    countFrom,
    built: builtDates.size,
    minimum: schedule.periodMinimum,
    target: schedule.periodTarget,
    extra: schedule.periodExtra,
    remaining: Math.max(0, schedule.periodMinimum - builtDates.size),
    isMinimumMet: builtDates.size >= schedule.periodMinimum,
  }
}

export function habitScheduleLabel(habit, value = new Date()) {
  const schedule = normalizeHabitSchedule(habit?.schedule, habit?.reminderDays, habit?.createdAt)
  if (schedule.kind === 'weekdays') {
    if (schedule.daysOfWeek.length === 7) return 'Todos los días'
    return `${schedule.daysOfWeek.length} ${schedule.daysOfWeek.length === 1 ? 'día' : 'días'} por semana`
  }
  if (PERIOD_MAXIMUM[schedule.kind]) {
    const progress = scheduleProgressForDate(habit, value)
    const period = schedule.kind === 'times_per_week' ? 'esta semana' : 'este mes'
    return `${progress.built} de ${progress.minimum} ${period}`
  }
  if (schedule.kind === 'every_n_days') {
    return schedule.intervalDays === 1 ? 'Todos los días' : `Cada ${schedule.intervalDays} días`
  }
  return `Ventana ${schedule.windowStart}–${schedule.windowEnd}`
}

export function isHabitScheduledForDate(habit, value = new Date()) {
  if (!habit || habit.isActive === false || ['paused', 'archived'].includes(habit.lifecycleStatus)) return false
  const schedule = normalizeHabitSchedule(habit.schedule, habit.reminderDays, habit.createdAt)
  if (!schedule.isActive) return false
  const dateKey = localDateKey(value, schedule.timezone)
  if (schedule.effectiveFrom && dateKey < schedule.effectiveFrom) return false
  if (schedule.effectiveTo && dateKey > schedule.effectiveTo) return false
  if (schedule.kind === 'weekdays') {
    const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay()
    return schedule.daysOfWeek.includes(weekday)
  }
  if (schedule.kind === 'every_n_days') {
    return dateKeyDistance(schedule.effectiveFrom, dateKey) % schedule.intervalDays === 0
  }
  if (PERIOD_MAXIMUM[schedule.kind]) {
    const day = dayNumberForLocalDate(habit.createdAt, dateKey, schedule.timezone)
    const hasRegistrationToday = habit.logs?.[day] !== undefined
    return hasRegistrationToday || !scheduleProgressForDate(habit, value).isMinimumMet
  }
  return true
}

export function logStatusForLevel(level) {
  return LOG_STATUS_BY_LEVEL[Number(level)] ?? 'not_done'
}

export function logLevelForStatus(status, minimumUsed = false) {
  if (status === 'partial' && minimumUsed) return 1
  return LOG_LEVEL_BY_STATUS[status] ?? 0
}

export function normalizeHabitLogOutcome(input = {}) {
  const hasCanonicalStatus = LOG_STATUSES.has(input.status)
  const status = hasCanonicalStatus ? input.status : logStatusForLevel(input.level)
  const minimumUsed = status === 'partial'
    && (hasCanonicalStatus ? Boolean(input.minimumUsed) : Number(input.level) === 1)
  const contextCodes = [...new Set((Array.isArray(input.contextCodes) ? input.contextCodes : [])
    .map(code => String(code ?? '').trim().toLowerCase())
    .filter(Boolean))]
  return {
    status,
    minimumUsed,
    contextCodes,
    level: logLevelForStatus(status, minimumUsed),
  }
}

export function normalizeHabitLog(log, { habit, day }) {
  const timezone = String(log?.timezone ?? habit?.schedule?.timezone ?? currentTimezone())
  const localDate = log?.localDate ?? localDateForDay(habit?.createdAt, day, timezone)
  const outcome = normalizeHabitLogOutcome(log)
  return {
    id: log?.id ?? randomId(),
    clientOperationId: log?.clientOperationId ?? randomId(),
    localDate,
    timezone,
    occurrenceKey: log?.occurrenceKey ?? `date:${localDate}`,
    ...outcome,
    emotion: log?.emotion ?? null,
    energy: log?.energy ?? null,
    note: log?.note ?? '',
    loggedAt: log?.loggedAt ?? new Date().toISOString(),
    version: Math.max(1, Number(log?.version) || 1),
  }
}

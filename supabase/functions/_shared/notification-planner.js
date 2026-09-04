import {
  COPY_CATALOG_HASH,
  COPY_CATALOG_VERSION,
} from './copy-contract.js'
import {
  selectDailyOpening,
  TRAKER_DAILY_MESSAGES,
} from './daily-opening.js'

const NOTIFICATION_KINDS = new Set([
  'morning_opening',
  'habit_or_block',
  'evening_close',
  'return_nudge',
])

export { COPY_CATALOG_HASH, COPY_CATALOG_VERSION }

/**
 * One notification catalog consumed by both the browser scheduler and the
 * Edge worker. Copy is intentionally privacy-safe: no habit names, notes,
 * emotions, family, health, work, or finance details are interpolated.
 */
export const NOTIFICATION_COPY = Object.freeze({
  morning_opening: Object.freeze([
    ...TRAKER_DAILY_MESSAGES,
  ]),
  habit_or_block: Object.freeze([
    { id: 'notification.habit_or_block.01', title: 'Tu siguiente paso está listo', singleBody: 'Tienes un mínimo pendiente. Puedes registrarlo cuando estés listo.', body: 'Tienes {count} mínimos pendientes. Elige uno y empieza por ahí.' },
    { id: 'notification.habit_or_block.02', title: 'Una opción es suficiente', singleBody: 'Hay una opción disponible para hoy. Un avance parcial también cuenta.', body: 'Hay {count} opciones disponibles. Mover una es suficiente para empezar.' },
    { id: 'notification.habit_or_block.03', title: 'Elige sin ponerte al corriente', singleBody: 'Puedes abrir el registro y decidir qué sí cabe hoy.', body: 'Puedes elegir una de {count} opciones. Las demás no se convierten en deuda.' },
  ]),
  evening_close: Object.freeze([
    { id: 'notification.evening_close.01', title: 'Cierra el día sin deuda', body: 'Guarda lo que sí pasó y deja que mañana empiece limpio.' },
    { id: 'notification.evening_close.02', title: 'Tu resumen de hoy está listo', body: 'Revisa lo registrado y cierra el día cuando quieras.' },
    { id: 'notification.evening_close.03', title: 'Lo de hoy puede quedarse aquí', body: 'Un cierre honesto basta; lo pendiente no pasa como deuda.' },
  ]),
  return_nudge: Object.freeze([
    { id: 'notification.return_nudge.01', title: 'Puedes volver sin ponerte al corriente', body: 'Abre Traker y elige un mínimo pequeño para hoy.' },
    { id: 'notification.return_nudge.02', title: 'No hay nada que recuperar', body: 'Tu historial sigue ahí. Elige solamente por dónde volver.' },
    { id: 'notification.return_nudge.03', title: 'Volver también cuenta', body: 'Puedes revisar tu agenda y escoger una entrada sencilla.' },
  ]),
})

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  enabled: false,
  morningEnabled: true,
  habitEnabled: true,
  closingEnabled: true,
  returnEnabled: true,
  morningTime: '08:00',
  closingTime: '20:00',
  quietStart: '21:30',
  quietEnd: '07:30',
  dailyBudget: 2,
  cooldownMinutes: 240,
  silencedUntil: null,
  lockScreenPrivacy: 'generic',
})

const KIND_TTL_MINUTES = Object.freeze({
  morning_opening: 240,
  habit_or_block: 120,
  evening_close: 180,
  return_nudge: 720,
})

function firstDefined(source, keys, fallback) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key]
  }
  return fallback
}

function booleanSetting(source, keys, fallback) {
  return Boolean(firstDefined(source, keys, fallback))
}

function integerSetting(source, keys, fallback, minimum, maximum) {
  const value = Number(firstDefined(source, keys, fallback))
  if (!Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

export function normalizeNotificationSettings(settings = {}) {
  return {
    enabled: booleanSetting(settings, ['enabled', 'notificationsEnabled', 'notifications_enabled'], false),
    morningEnabled: booleanSetting(settings, ['morningEnabled', 'morningReminderEnabled', 'morning_enabled'], true),
    habitEnabled: booleanSetting(settings, ['habitEnabled', 'habitRemindersEnabled', 'habit_enabled'], true),
    closingEnabled: booleanSetting(settings, ['closingEnabled', 'closingReminderEnabled', 'closing_enabled'], true),
    returnEnabled: booleanSetting(settings, ['returnEnabled', 'returnReminderEnabled', 'return_enabled'], true),
    morningTime: String(firstDefined(settings, ['morningTime', 'morningReminderTime', 'morning_time'], '08:00')),
    closingTime: String(firstDefined(settings, ['closingTime', 'closingReminderTime', 'closing_time'], '20:00')),
    quietStart: String(firstDefined(settings, ['quietStart', 'notificationQuietStart', 'quiet_start'], '21:30')),
    quietEnd: String(firstDefined(settings, ['quietEnd', 'notificationQuietEnd', 'quiet_end'], '07:30')),
    dailyBudget: integerSetting(settings, ['dailyBudget', 'notificationDailyBudget', 'daily_budget'], 2, 0, 6),
    cooldownMinutes: integerSetting(settings, ['cooldownMinutes', 'notificationCooldownMinutes'], 240, 0, 1_440),
    silencedUntil: firstDefined(settings, ['silencedUntil', 'notificationSilencedUntil', 'silenced_until'], null),
    lockScreenPrivacy: firstDefined(settings, ['lockScreenPrivacy', 'lock_screen_privacy'], 'generic') === 'names_allowed'
      ? 'names_allowed'
      : 'generic',
  }
}

export function hhmmToMinutes(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function localTimeParts(value = new Date(), timezone = 'America/Mexico_City') {
  const date = value instanceof Date ? value : new Date(value)
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  let formatter
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return localTimeParts(safeDate, 'America/Mexico_City')
  }
  const parts = Object.fromEntries(formatter.formatToParts(safeDate).map(part => [part.type, part.value]))
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function isDueAt(targetTime, currentMinutes, windowMinutes = 1) {
  const targetMinutes = hhmmToMinutes(targetTime)
  if (targetMinutes === null) return false
  const difference = currentMinutes - targetMinutes
  return difference >= 0 && difference < Math.max(1, Number(windowMinutes) || 1)
}

export function isQuietAt(currentMinutes, quietStart, quietEnd) {
  const start = hhmmToMinutes(quietStart)
  const end = hhmmToMinutes(quietEnd)
  if (start === null || end === null || start === end) return false
  if (start < end) return currentMinutes >= start && currentMinutes < end
  return currentMinutes >= start || currentMinutes < end
}

function validTimestamp(value) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function historyLocalDate(item, timezone) {
  if (item?.localDate) return String(item.localDate)
  const timestamp = validTimestamp(item?.at ?? item?.sentAt ?? item?.created_at)
  return timestamp === null ? null : localTimeParts(new Date(timestamp), timezone).localDate
}

function shownHistory(history = []) {
  return history.filter(item => NOTIFICATION_KINDS.has(item?.kind) && item?.status !== 'failed')
}

function timestampOf(item) {
  return validTimestamp(item?.at ?? item?.sentAt ?? item?.created_at) ?? 0
}

function stableIndex(seed, length) {
  let hash = 2166136261
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % Math.max(1, length)
}

export function selectNotificationCopy(kind, count = 0, history = [], seed = '') {
  const pool = NOTIFICATION_COPY[kind] ?? NOTIFICATION_COPY.morning_opening
  const withPhrase = history
    .filter(item => item?.phraseId)
    .sort((a, b) => timestampOf(b) - timestampOf(a))
  const globalRecent = new Set(withPhrase.slice(0, 8).map(item => item.phraseId))
  const eventRecent = new Set(withPhrase.filter(item => item.kind === kind).slice(0, 3).map(item => item.phraseId))
  const outsideEvent = pool.filter(item => !eventRecent.has(item.id))
  const outsideGlobal = outsideEvent.filter(item => !globalRecent.has(item.id))
  const candidates = outsideGlobal.length ? outsideGlobal : outsideEvent.length ? outsideEvent : pool
  const selected = candidates[stableIndex(`${seed}:${kind}:${count}`, candidates.length)]
  return {
    id: selected.id,
    title: selected.title,
    body: (count === 1 && selected.singleBody ? selected.singleBody : selected.body)
      .replace('{count}', String(count)),
  }
}

function buildIntent(kind, { now, localDate, count = 0, referenceIds = [], history = [] }) {
  const copy = kind === 'morning_opening'
    ? selectDailyOpening(localDate)
    : selectNotificationCopy(kind, count, history, `${localDate}:${referenceIds.join(',')}`)
  const action = kind === 'evening_close' ? 'close' : kind === 'return_nudge' ? 'resume' : kind === 'habit_or_block' ? 'log' : 'open'
  const expiresAt = new Date(now.getTime() + KIND_TTL_MINUTES[kind] * 60_000).toISOString()
  return {
    kind,
    jobKey: `${localDate}:${kind}`,
    intentKey: `${localDate}:${kind}`,
    title: copy.title,
    body: copy.body,
    phraseId: copy.id,
    copyVersion: COPY_CATALOG_VERSION,
    copyHash: COPY_CATALOG_HASH,
    count,
    referenceIds,
    scheduledAt: now.toISOString(),
    expiresAt,
    url: `/?intent=${action}`,
  }
}

function suppressed(reason, context) {
  return { intentions: [], suppression: reason, ...context }
}

/**
 * Pure notification decision. It deliberately emits at most one intent.
 * `agenda` contains today's already-scheduled items, with `registered` and
 * `reminderTime` resolved by the caller's canonical habit model.
 */
export function evaluateNotificationPlan({
  now: nowValue = new Date(),
  timezone = 'America/Mexico_City',
  agenda = [],
  settings: rawSettings = {},
  history = [],
  dayClosure = null,
  daysSinceActivity = 0,
  windowMinutes = 1,
} = {}) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue)
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now
  const settings = normalizeNotificationSettings(rawSettings)
  const { localDate, minutes } = localTimeParts(safeNow, timezone)
  const sentHistory = shownHistory(history)
  const todayHistory = sentHistory.filter(item => historyLocalDate(item, timezone) === localDate)
  const budgetUsed = todayHistory.length
  const context = {
    localDate,
    budgetUsed,
    budgetRemaining: Math.max(0, settings.dailyBudget - budgetUsed),
  }

  if (!settings.enabled) return suppressed('disabled', context)
  const silencedUntil = validTimestamp(settings.silencedUntil)
  if (silencedUntil !== null && safeNow.getTime() < silencedUntil) return suppressed('silenced', context)
  if (isQuietAt(minutes, settings.quietStart, settings.quietEnd)) return suppressed('quiet_hours', context)
  if (budgetUsed >= settings.dailyBudget) return suppressed('daily_budget', context)

  const mostRecent = sentHistory
    .map(item => validTimestamp(item?.at ?? item?.sentAt ?? item?.created_at))
    .filter(value => value !== null)
    .sort((a, b) => b - a)[0]
  if (mostRecent !== undefined && safeNow.getTime() - mostRecent < settings.cooldownMinutes * 60_000) {
    return suppressed('cooldown', context)
  }

  const pendingDue = agenda.filter(item =>
    item?.registered !== true &&
    item?.isActive !== false &&
    isDueAt(item?.reminderTime, minutes, windowMinutes)
  )

  let kind = null
  if (settings.habitEnabled && pendingDue.length) kind = 'habit_or_block'
  else if (settings.closingEnabled && !dayClosure && isDueAt(settings.closingTime, minutes, windowMinutes)) kind = 'evening_close'
  else if (settings.morningEnabled && agenda.length && isDueAt(settings.morningTime, minutes, windowMinutes)) kind = 'morning_opening'
  else if (settings.returnEnabled && Number(daysSinceActivity) >= 3 && isDueAt(settings.morningTime, minutes, windowMinutes)) {
    const lastReturn = sentHistory
      .filter(item => item.kind === 'return_nudge')
      .map(item => validTimestamp(item?.at ?? item?.sentAt ?? item?.created_at))
      .filter(value => value !== null)
      .sort((a, b) => b - a)[0]
    if (lastReturn === undefined || safeNow.getTime() - lastReturn >= 7 * 86_400_000) kind = 'return_nudge'
  }

  if (!kind) return suppressed('not_due', context)
  const intentKey = `${localDate}:${kind}`
  if (sentHistory.some(item => item?.intentKey === intentKey || item?.jobKey === intentKey)) {
    return suppressed('already_sent', context)
  }

  const referenceIds = kind === 'habit_or_block'
    ? pendingDue.map(item => String(item.id)).sort()
    : []
  const intention = buildIntent(kind, {
    now: safeNow,
    localDate,
    count: referenceIds.length,
    referenceIds,
    history: sentHistory,
  })
  return { intentions: [intention], suppression: null, ...context }
}

export function planNotifications(input) {
  return evaluateNotificationPlan(input).intentions
}

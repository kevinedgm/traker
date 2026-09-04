/**
 * @file notifications.service.js
 *
 * Web Notifications + scheduling for habit reminders.
 *
 * Architecture
 * ────────────
 *  Permission management
 *    getPermission()      → current Notification.permission string
 *    requestPermission()  → asks the browser, returns new state
 *
 *  Sending
 *    showNotification(title, options)
 *      → delegates to SW via postMessage so the notification
 *        appears even when the tab is not focused.
 *      → falls back to new Notification() if no SW is available.
 *
 *  Scheduling (in-process, runs while browser tab is open)
 *    startScheduler(getHabitsFn)
 *      → polls every 30 s; fires when HH:MM matches a habit's
 *        reminder and weekday is in reminderDays (or all days).
 *    stopScheduler()
 *
 * Notes:
 *  - Duplicate-fire guard: uses a "fired" Set keyed by
 *    "habitId-YYYY-MM-DD-HH:MM" so each habit fires at most once
 *    per minute even if the interval overshoots.
 *  - The scheduler only fires notifications; it does NOT request
 *    permission on its own — call requestPermission() first.
 */

import { storage } from '@services/storage'
import { pickPhrase } from '@/features/copy/engine.js'
import { readCopyState, writeCopyState } from '@/features/copy/state.js'
import { features } from '@/config/features.js'
import {
  currentTimezone,
  dayNumberForLocalDate,
  isHabitScheduledForDate,
  localDateKey,
} from '@/features/habits/domain.js'
import { evaluateNotificationPlan } from '@/features/notifications/planner.js'
import { actionsForNotification } from '../../supabase/functions/_shared/notification-actions.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function supported() {
  return 'Notification' in window
}

function swReady() {
  return 'serviceWorker' in navigator
}

// App base path ('/' in dev, '/traker/' on GitHub Pages).
// Icon URLs must include it — absolute '/favicon.svg' 404s in production.
const BASE = import.meta.env.BASE_URL ?? '/'
const ICON_URL = `${BASE}icons/pwa-192x192.png`

// ── Permission API ─────────────────────────────────────────────────────────

/**
 * Returns the current permission state.
 * 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getPermission() {
  if (!supported()) return 'unsupported'
  return Notification.permission
}

/**
 * Prompts the user for notification permission.
 * Returns the resulting permission string.
 * No-op (returns current state) if already granted or denied.
 */
export async function requestPermission() {
  if (!supported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

// ── Sent-notification log (for the diagnostics screen) ────────────────────

const LOG_KEY = storage.KEYS.NOTIFICATION_LOG
const LOG_MAX = 50

function _recordSent(title, body, options = {}) {
  const log = storage.read(LOG_KEY, [])
  const at = new Date().toISOString()
  log.unshift({
    title,
    body: body ?? '',
    at,
    status: 'delivered',
    kind: options?.data?.kind ?? null,
    intentKey: options?.data?.intentKey ?? null,
    localDate: options?.data?.localDate ?? null,
    phraseId: options?.data?.phraseId ?? null,
    copyVersion: options?.data?.copyVersion ?? null,
    copyHash: options?.data?.copyHash ?? null,
  })
  storage.write(LOG_KEY, log.slice(0, LOG_MAX))
}

/** Most-recent-first list of notifications actually shown on this device. */
export function getNotificationLog() {
  const log = storage.read(LOG_KEY, [])
  return Array.isArray(log) ? log : []
}

// ── Show notification ──────────────────────────────────────────────────────

/**
 * Show a notification.
 *
 * Prefers the Service Worker path (works when tab is hidden).
 * Falls back to the Notification constructor.
 *
 * @param {string}  title
 * @param {object}  [options]  — Notification options (body, tag, data, …)
 */
export async function showNotification(title, options = {}) {
  if (!supported() || Notification.permission !== 'granted') return false

  // With Traker visible, use the Aurora in-app banner from the notification
  // design instead of asking the operating system to cover the interface.
  if (document.visibilityState === 'visible') {
    window.dispatchEvent(new CustomEvent('traker:notification', {
      detail: {
        title,
        body: options.body ?? '',
        phraseId: options?.data?.phraseId ?? null,
        copyVersion: options?.data?.copyVersion ?? null,
      },
    }))
    _recordSent(title, options.body, options)
    return true
  }

  // Try Service Worker first (survives tab going to background)
  if (swReady()) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        icon:    ICON_URL,
        badge:   ICON_URL,
        vibrate: [180, 80, 180],
        tag:     options.tag ?? 'traker-reminder',
        renotify: true,
        ...options,
      })
      _recordSent(title, options.body, options)
      return true
    } catch {
      // SW path failed — fall through to direct API
    }
  }

  // Fallback: direct Notification constructor
  // (throws on Android Chrome, where only the SW path is allowed)
  new Notification(title, {
    icon: ICON_URL,
    ...options,
  })
  _recordSent(title, options.body, options)
  return true
}

// ── Copy resolution (personality engine, imported directly — no Vue) ───────
//
// This file runs outside any component/composable context (it's a plain
// module-level scheduler), so it talks to the pure engine directly instead
// of going through useCopy.js. It shares the SAME localStorage history key
// as useCopy.js, so anti-repetition stays consistent regardless of which
// entry point resolved a given phrase.

/**
 * Resolve a copy-engine phrase for a notification body.
 * @param {string} event
 * @param {{ habit?: object, category?: string, vars?: object }} [opts]
 * @returns {{ id: string, text: string }}
 */
function _resolveCopy(event, { habit = null, category, vars = {} } = {}) {
  const copySettings = habit?.copySettings ?? null
  const resolvedCategory = category || copySettings?.category || 'generic'

  if (!features.copyPersonality) {
    return pickPhrase({ event, category: resolvedCategory, tone: 'normal', vars }).phrase
  }

  const settings = _getSettings?.() ?? null
  let tone = copySettings?.toneOverride || settings?.tone || 'no_respect'
  if (copySettings?.carrillaEnabled === false) tone = 'normal'

  const state = readCopyState()
  const historyKey = `${event}:${resolvedCategory}`
  const recentIds = state.recent[historyKey] ?? []
  const disabledIds = [
    ...state.disabled,
    ...(Array.isArray(copySettings?.disabledEventIds) ? copySettings.disabledEventIds : []),
  ]

  const result = pickPhrase({
    event,
    category: resolvedCategory,
    tone,
    vars,
    recentIds,
    globalRecentIds: state.globalRecent,
    customPhrases: copySettings?.customPhrases ?? null,
    preferCustom: Boolean(copySettings?.preferCustomPhrases),
    disabledIds,
    favoriteIds: state.favorites,
  })

  state.recent[historyKey] = result.recentIds
  state.globalRecent = result.globalRecentIds
  writeCopyState(state)
  return result.phrase
}

// ── Scheduler ──────────────────────────────────────────────────────────────

/** @type {ReturnType<typeof setInterval> | null} */
let _interval    = null

/** @type {(() => object[]) | null} */
let _getHabits   = null

/** @type {(() => object | null) | null} */
let _getSettings = null

/** @type {(() => object | null) | null} */
let _getContext = null

let _tickRunning = false
let _lastEvaluation = null
let _cloudDeliveryActive = storage.read(storage.KEYS.PUSH_ACTIVE, false) === true

export function setCloudDeliveryActive(active) {
  _cloudDeliveryActive = Boolean(active)
}

if (typeof window !== 'undefined') {
  window.addEventListener('traker:push-state', event => {
    setCloudDeliveryActive(event.detail?.active === true)
  })
}

/**
 * Start the reminder scheduler.
 * Safe to call multiple times — only one interval runs at a time.
 *
 * @param {() => object[]} getHabitsFn  Reactive getter returning the habits array
 * @param {() => object | null} [getSettingsFn]  Reactive getter returning settings
 */
export function startScheduler(getHabitsFn, getSettingsFn = null, getContextFn = null) {
  _getHabits = getHabitsFn
  _getSettings = getSettingsFn
  if (getContextFn) _getContext = getContextFn
  if (_interval !== null) return          // already running

  void runSchedulerTick()                                 // fire immediately on start
  _interval = setInterval(() => void runSchedulerTick(), 30_000)  // then every 30 s
}

/** Stop the scheduler (e.g. on app unmount). */
export function stopScheduler() {
  if (_interval !== null) {
    clearInterval(_interval)
    _interval = null
  }
}

/** True while the in-app reminder scheduler interval is alive. */
export function isSchedulerRunning() {
  return _interval !== null
}

/** Most recent planner result, useful for diagnostics without re-planning. */
export function getLastSchedulerEvaluation() {
  return _lastEvaluation
}

// ── Diagnostics ────────────────────────────────────────────────────────────

/**
 * Snapshot of everything the diagnostics screen needs to explain
 * whether notifications can work on this device right now.
 *
 * @returns {Promise<{
 *   supported: boolean,
 *   permission: string,
 *   swState: 'active'|'registered'|'none'|'error'|'unsupported',
 *   pushSubscribed: boolean|null,   // null = Push API not available
 *   standalone: boolean,            // installed as PWA (display-mode)
 *   schedulerRunning: boolean,
 * }>}
 */
export async function getDiagnostics() {
  let swState = 'unsupported'
  let pushSubscribed = null

  if (swReady()) {
    swState = 'none'
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        swState = reg.active ? 'active' : 'registered'
        if (reg.pushManager) {
          const sub = await reg.pushManager.getSubscription()
          pushSubscribed = Boolean(sub)
        }
      }
    } catch {
      swState = 'error'
    }
  }

  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true   // iOS Safari
  const requiresHomeScreenForPush =
    typeof window.navigator.standalone === 'boolean' && !standalone

  return {
    supported:        supported(),
    permission:       getPermission(),
    swState,
    pushSubscribed,
    standalone,
    requiresHomeScreenForPush,
    schedulerRunning: isSchedulerRunning(),
    planner: _lastEvaluation,
  }
}

/**
 * Fire a test notification through the same path real reminders use.
 * Pass `{ title, body }` to preview a specific resolved phrase (used by
 * CreateHabitModal's "Probar notificación" for a habit's custom carrilla)
 * — defaults to the generic morning-motivation copy otherwise.
 * @param {{ title?: string, body?: string }} [override]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function sendTestNotification({ title, body } = {}) {
  if (!supported()) return { ok: false, reason: 'unsupported' }
  if (Notification.permission !== 'granted') {
    return { ok: false, reason: Notification.permission }
  }

  try {
    const shown = await showNotification(title || 'Traker', {
      body: body || _resolveCopy('morning_motivation', {}).text,
      tag:  'traker-test',
      data: { url: '/settings/notifications' },
    })
    return shown ? { ok: true } : { ok: false, reason: 'not-shown' }
  } catch (err) {
    return { ok: false, reason: err?.message ?? 'error' }
  }
}

function schedulerAgenda(habits, now, timezone) {
  const localDate = localDateKey(now, timezone)
  return habits
    .filter(habit => isHabitScheduledForDate(habit, now))
    .map(habit => {
      const habitTimezone = habit.schedule?.timezone ?? timezone
      const habitDate = localDateKey(now, habitTimezone)
      const day = dayNumberForLocalDate(habit.createdAt, habitDate, habitTimezone)
      return {
        id: habit.id,
        reminderTime: habit.reminder,
        registered: habit.logs?.[day] !== undefined,
        isActive: habit.isActive !== false,
        localDate,
      }
    })
}

function daysSinceLastActivity(habits, now) {
  const latest = habits
    .flatMap(habit => Object.values(habit?.logs ?? {}))
    .map(log => new Date(log?.loggedAt ?? log?.updatedAt ?? 0).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0]
  if (latest === undefined) return 0
  return Math.max(0, Math.floor((now.getTime() - latest) / 86_400_000))
}

/**
 * Evaluate and, when due, show exactly one local notification.
 * Exported to make scheduler behavior deterministic in tests.
 */
export async function runSchedulerTick(nowValue = new Date()) {
  if (_tickRunning || !_getHabits) return _lastEvaluation
  if (!supported() || Notification.permission !== 'granted') return null
  _tickRunning = true
  try {
    const now = nowValue instanceof Date ? nowValue : new Date(nowValue)
    const habits = _getHabits() ?? []
    const settings = _getSettings?.() ?? null
    const context = _getContext?.() ?? {}
    const timezone = context.timezone ?? currentTimezone()
    const agenda = schedulerAgenda(habits, now, timezone)
    const localDate = localDateKey(now, timezone)
    const evaluation = evaluateNotificationPlan({
      now,
      timezone,
      agenda,
      settings,
      history: getNotificationLog(),
      dayClosure: context.dayClosure ?? null,
      daysSinceActivity: context.daysSinceActivity ?? daysSinceLastActivity(habits, now),
      windowMinutes: 1,
    })
    if (_cloudDeliveryActive && navigator.onLine !== false) {
      _lastEvaluation = {
        ...evaluation,
        intentions: [],
        suppression: 'cloud_delivery',
      }
      return _lastEvaluation
    }
    _lastEvaluation = evaluation
    const intent = evaluation.intentions[0]
    if (!intent) return evaluation
    const actions = actionsForNotification({
      kind: intent.kind,
      referenceIds: intent.referenceIds,
      directActionsEnabled: settings?.notificationDirectActionsEnabled === true,
    })
    const habitId = actions.length ? intent.referenceIds[0] : null
    await showNotification(intent.title, {
      body: intent.body,
      tag: habitId ? `habit-${habitId}` : `traker-${intent.kind}`,
      renotify: false,
      actions,
      data: {
        url: intent.url,
        habitId,
        kind: intent.kind,
        intentKey: intent.intentKey,
        localDate,
        phraseId: intent.phraseId,
        copyVersion: intent.copyVersion,
        copyHash: intent.copyHash,
      },
    })
    return evaluation
  } finally {
    _tickRunning = false
  }
}

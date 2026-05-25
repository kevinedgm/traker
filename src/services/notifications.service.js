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

// ── Helpers ────────────────────────────────────────────────────────────────

function supported() {
  return 'Notification' in window
}

function swReady() {
  return 'serviceWorker' in navigator
}

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
  if (!supported() || Notification.permission !== 'granted') return

  // Try Service Worker first (survives tab going to background)
  if (swReady()) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        icon:    '/favicon.svg',
        badge:   '/favicon.svg',
        vibrate: [180, 80, 180],
        tag:     options.tag ?? 'traker-reminder',
        renotify: true,
        ...options,
      })
      return
    } catch {
      // SW path failed — fall through to direct API
    }
  }

  // Fallback: direct Notification constructor
  new Notification(title, {
    icon: '/favicon.svg',
    ...options,
  })
}

// ── Scheduler ──────────────────────────────────────────────────────────────

/** @type {ReturnType<typeof setInterval> | null} */
let _interval    = null

/** @type {(() => object[]) | null} */
let _getHabits   = null

/** Set of "habitId-date-HH:MM" keys — prevents double-fire in same minute */
const _firedKeys = new Set()

/**
 * Start the reminder scheduler.
 * Safe to call multiple times — only one interval runs at a time.
 *
 * @param {() => object[]} getHabitsFn  Reactive getter returning the habits array
 */
export function startScheduler(getHabitsFn) {
  _getHabits = getHabitsFn
  if (_interval !== null) return          // already running

  _tick()                                 // fire immediately on start
  _interval = setInterval(_tick, 30_000)  // then every 30 s
}

/** Stop the scheduler (e.g. on app unmount). */
export function stopScheduler() {
  if (_interval !== null) {
    clearInterval(_interval)
    _interval = null
  }
}

/** Evict old keys from _firedKeys so memory stays bounded. */
function _pruneOldKeys() {
  if (_firedKeys.size < 200) return
  // Keep only today's keys
  const today = _todayStr()
  for (const key of _firedKeys) {
    if (!key.includes(today)) _firedKeys.delete(key)
  }
}

function _todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function _tick() {
  if (Notification.permission !== 'granted') return
  if (!_getHabits) return

  _pruneOldKeys()

  const now     = new Date()
  const hhmm    = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const weekday = now.getDay()            // 0 = Sunday … 6 = Saturday
  const dateStr = _todayStr()

  for (const habit of _getHabits()) {
    // Skip habits without a reminder time set
    if (!habit.reminder) continue

    // Skip if reminder time doesn't match current HH:MM
    if (habit.reminder !== hhmm) continue

    // Skip if today's weekday is not in the allowed days list
    const days = habit.reminderDays
    if (Array.isArray(days) && days.length > 0 && !days.includes(weekday)) continue

    // Deduplicate: only fire once per (habit, minute)
    const fireKey = `${habit.id}-${dateStr}-${hhmm}`
    if (_firedKeys.has(fireKey)) continue
    _firedKeys.add(fireKey)

    // Fire!
    showNotification(`${habit.icon} ${habit.name}`, {
      body:    '¡Es hora de registrar tu hábito!',
      tag:     `habit-${habit.id}`,
      renotify: true,
      data:    { url: `/habit/${habit.id}` },
    })
  }
}

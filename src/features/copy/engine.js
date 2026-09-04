/**
 * @file engine.js
 * Pure selection engine for Traker's copy/personality system.
 *
 * No Vue/Pinia, no localStorage — everything the engine needs (recent
 * history, disabled ids, rng) is passed in, and everything it produces
 * (the picked phrase, the updated history) is returned. Callers
 * (useCopy.js) own persistence.
 */

import { CATEGORY_EVENTS, EVENT_FALLBACKS, FALLBACK_PHRASE, GENERIC_EVENTS, SENSITIVE_CATEGORIES } from './catalog.js'
import { NEUTRAL_ONLY_EVENT_IDS } from '../../../supabase/functions/_shared/copy-contract.js'

/** Per-event and cross-event history limits from the communication contract. */
export const RECENT_LIMIT = 3
export const GLOBAL_RECENT_LIMIT = 8

/** Variables allowed to interpolate into each event's text. Anything else is left untouched. */
export const EVENT_VARS = {
  habit_reminder:          ['habitName', 'hour'],
  habit_completed:         ['habitName'],
  habit_partial:           ['habitName'],
  habit_skipped:           ['habitName'],
  habit_paused:            ['habitName'],
  habit_returned:          ['habitName', 'daysAway'],
  task_started:            ['habitName', 'minutes'],
  minimal_version:         ['habitName'],
  too_many_goals:          ['count'],
  perfectionism_detected:  ['habitName'],
  inactivity_return:       ['daysAway'],
  goal_completed:          ['habitName'],
  goal_paused:             ['goalName'],
  goal_returned:           ['goalName'],
  goal_reformulated:       ['goalName'],
  goal_closed:             ['goalName'],
  session_completed:       ['goalName', 'minutes'],
  evening_summary:         ['completions', 'total'],
  day_closed:              ['completions', 'total'],
  morning_motivation:      [],
  inactivity_nudge:        [],
  offline:                 [],
  sync_error:              [],
  generic_error:           [],
}

/**
 * Replace `{var}` tokens with values from `vars`, restricted to the
 * whitelist for `event`. Unknown/unwhitelisted tokens are left as-is
 * (should never happen — catalog phrases only use whitelisted vars).
 * Missing values become an empty string; surrounding double spaces
 * created by that are collapsed.
 */
export function interpolate(text, event, vars = {}) {
  const allowed = EVENT_VARS[event] ?? []
  const replaced = String(text).replace(/\{(\w+)\}/g, (match, key) => {
    if (!allowed.includes(key)) return match
    const value = vars?.[key]
    return value === undefined || value === null ? '' : String(value)
  })
  return replaced.replace(/\s{2,}/g, ' ').trim()
}

/** True when `tone` should be degraded to 'trusted' for catalog (not custom) phrases. */
function shouldDegrade(category, tone) {
  return tone === 'no_respect' && SENSITIVE_CATEGORIES.has(category)
}

/** Cascading catalog lookup: category+event+tone → generic+event+tone → generic+event+normal → []. */
function resolveCatalogPool(event, category, tone) {
  const effectiveTone = NEUTRAL_ONLY_EVENT_IDS.includes(event)
    ? 'normal'
    : shouldDegrade(category, tone) ? 'trusted' : tone

  let pool = CATEGORY_EVENTS[category]?.[event]?.[effectiveTone]
  if (pool?.length) return pool

  pool = GENERIC_EVENTS[event]?.[effectiveTone]
  if (pool?.length) return pool

  if (effectiveTone !== 'normal') {
    pool = GENERIC_EVENTS[event]?.normal
    if (pool?.length) return pool
  }

  return []
}

function buildCustomPool(event, customPhrases) {
  const raw = customPhrases?.[event]
  if (!Array.isArray(raw) || !raw.length) return []
  return raw
    .map((text, i) => ({ id: `custom.${event}.${String(i + 1).padStart(2, '0')}`, text: String(text ?? '').trim() }))
    .filter(p => p.text.length > 0)
}

/**
 * Pick a phrase for `event`, resolving category/tone/custom overrides,
 * anti-repetition and disabled ids, then interpolating `vars`.
 *
 * @returns {{ phrase: {id: string, text: string}, recentIds: string[], usingCustom: boolean }}
 */
export function pickPhrase({
  event,
  category = 'generic',
  tone = 'no_respect',
  vars = {},
  recentIds = [],
  globalRecentIds = [],
  customPhrases = null,
  preferCustom = false,
  disabledIds = [],
  favoriteIds = [],
  rng = Math.random,
} = {}) {
  const catalogPool = resolveCatalogPool(event, category, tone)
  const customPool = buildCustomPool(event, customPhrases)

  let pool
  let usingCustom = false

  if ((preferCustom || catalogPool.length === 0) && customPool.length) {
    pool = customPool
    usingCustom = true
  } else if (catalogPool.length) {
    pool = catalogPool
  } else if (customPool.length) {
    pool = customPool
    usingCustom = true
  } else {
    pool = [FALLBACK_PHRASE]
  }

  // Disabled means disabled. If the pool becomes empty, use a separate
  // functional fallback instead of reviving an id the person explicitly hid.
  const disabled = new Set(disabledIds)
  let candidates = pool.filter(p => !disabled.has(p.id))
  if (!candidates.length) candidates = [EVENT_FALLBACKS[event] ?? FALLBACK_PHRASE]

  // Prefer candidates outside both histories. If a small pool is exhausted,
  // relax global history first and per-event history second.
  const eventFiltered = candidates.filter(p => !recentIds.includes(p.id))
  const globalFiltered = eventFiltered.filter(p => !globalRecentIds.includes(p.id))
  const filtered = globalFiltered.length ? globalFiltered : eventFiltered.length ? eventFiltered : candidates

  // Saved/favorite phrases get one extra ticket (2× weight), never exclusivity.
  const favorites = new Set(favoriteIds)
  const weighted = filtered.flatMap(phrase => favorites.has(phrase.id) ? [phrase, phrase] : [phrase])

  const index = Math.min(weighted.length - 1, Math.floor(rng() * weighted.length))
  const picked = weighted[Math.max(0, index)]

  const nextRecentIds = [...recentIds, picked.id].slice(-RECENT_LIMIT)
  const nextGlobalRecentIds = [...globalRecentIds, picked.id].slice(-GLOBAL_RECENT_LIMIT)

  return {
    phrase: { id: picked.id, text: interpolate(picked.text, event, vars) },
    recentIds: nextRecentIds,
    globalRecentIds: nextGlobalRecentIds,
    usingCustom,
  }
}

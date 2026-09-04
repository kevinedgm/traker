import {
  COPY_CATALOG_HASH,
  COPY_CATALOG_VERSION,
} from './copy-contract.js'

export const DAILY_OPENING_SOURCE_TYPES = Object.freeze({
  PERSONAL: 'personal',
  TRAKER: 'traker',
  QUOTE: 'quote',
})

/**
 * Privacy-safe messages shared by the dashboard and the notification worker.
 * They never interpolate names, goals, notes, emotions, or personal motives.
 */
export const TRAKER_DAILY_MESSAGES = Object.freeze([
  Object.freeze({
    id: 'daily.traker.01',
    title: 'Un inicio pequeño cuenta',
    body: 'Elige qué mínimo quieres mover hoy y empieza por ahí.',
    sourceType: DAILY_OPENING_SOURCE_TYPES.TRAKER,
    tone: 'normal',
    language: 'es-MX',
  }),
  Object.freeze({
    id: 'daily.traker.02',
    title: 'Hoy basta con una cosa',
    body: 'Mueve una cosa que importe; lo demás puede esperar.',
    sourceType: DAILY_OPENING_SOURCE_TYPES.TRAKER,
    tone: 'normal',
    language: 'es-MX',
  }),
  Object.freeze({
    id: 'daily.traker.03',
    title: 'Tu día está listo',
    body: 'Puedes empezar con la opción más sencilla de tu agenda.',
    sourceType: DAILY_OPENING_SOURCE_TYPES.TRAKER,
    tone: 'normal',
    language: 'es-MX',
  }),
])

/**
 * Editorial gate for attributed quotations.
 *
 * The MVP intentionally ships with no attributed quotations. Additions must
 * include every field validated by `isVerifiedQuote` and pass human review.
 */
export const VERIFIED_DAILY_QUOTES = Object.freeze([])

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isVerifiedQuote(entry) {
  if (!entry || entry.sourceType !== DAILY_OPENING_SOURCE_TYPES.QUOTE) return false
  const required = [
    'id',
    'text',
    'author',
    'work',
    'source',
    'language',
    'theme',
    'usageCondition',
  ]
  if (!required.every(field => clean(entry[field]))) return false
  try {
    const source = new URL(entry.source)
    return source.protocol === 'https:' || source.protocol === 'http:'
  } catch {
    return false
  }
}

export function stableDailyIndex(seed, length) {
  if (!Number.isInteger(length) || length < 1) return 0
  let hash = 2166136261
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % length
}

function quoteAsOpening(quote) {
  return {
    id: quote.id,
    title: 'Una idea para hoy',
    body: clean(quote.translation) || clean(quote.text),
    sourceType: DAILY_OPENING_SOURCE_TYPES.QUOTE,
    sourceLabel: 'Cita verificada',
    tone: 'normal',
    language: clean(quote.translation) ? 'es-MX' : quote.language,
    attribution: {
      author: quote.author,
      work: quote.work,
      source: quote.source,
      originalLanguage: quote.language,
      originalText: quote.text,
      usageCondition: quote.usageCondition,
    },
  }
}

/**
 * Picks one public opening for a local calendar date.
 *
 * Fifteen percent of deterministic slots are reserved for verified quotes.
 * While the reviewed quote catalog is empty, those slots safely fall back to
 * a Traker message instead of inventing an attribution.
 */
export function selectDailyOpening(localDate) {
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(localDate))
    ? String(localDate)
    : '1970-01-01'
  const quotes = VERIFIED_DAILY_QUOTES.filter(isVerifiedQuote)
  const sourceSlot = stableDailyIndex(`${dateKey}:source`, 100)
  let selected

  if (sourceSlot < 15 && quotes.length) {
    selected = quoteAsOpening(quotes[stableDailyIndex(`${dateKey}:quote`, quotes.length)])
  } else {
    const message = TRAKER_DAILY_MESSAGES[stableDailyIndex(`${dateKey}:traker`, TRAKER_DAILY_MESSAGES.length)]
    selected = {
      ...message,
      sourceLabel: 'Mensaje de Traker',
      attribution: null,
    }
  }

  return Object.freeze({
    ...selected,
    localDate: dateKey,
    catalogVersion: COPY_CATALOG_VERSION,
    catalogHash: COPY_CATALOG_HASH,
  })
}

/**
 * Personal context stays separate from the public opening so it can be shown
 * in-app without leaking into a lock-screen notification.
 */
export function composeTodayOpening({ localDate, personalReason = '' } = {}) {
  const message = selectDailyOpening(localDate)
  const reason = clean(personalReason)
  return Object.freeze({
    ...message,
    personalContext: reason
      ? Object.freeze({
          sourceType: DAILY_OPENING_SOURCE_TYPES.PERSONAL,
          sourceLabel: 'Tu motivo',
          text: reason,
        })
      : null,
  })
}

import { currentTimezone, localDateKey } from '@/features/habits/domain.js'

export const CHECKIN_LOAD_FEELINGS = Object.freeze(['light', 'okay', 'heavy'])
export const CHECKIN_SYNC_SCOPES = Object.freeze(['local_only', 'cloud'])
export const CHECKIN_SYNC_STATUSES = Object.freeze(['local', 'pending', 'synced', 'error'])

const RATING_MIN = 1
const RATING_MAX = 5
const NOTE_MAX_LENGTH = 500

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const random = Math.floor(Math.random() * 16)
      return (token === 'x' ? random : ((random & 0x3) | 0x8)).toString(16)
    })
}

function optionalRating(value) {
  if (value === null || value === undefined || value === '') return null
  const rating = Number(value)
  return Number.isInteger(rating) && rating >= RATING_MIN && rating <= RATING_MAX
    ? rating
    : null
}

export function normalizeContextCodes(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values
    .map(value => String(value ?? '').trim().toLowerCase())
    .filter(Boolean))]
}

export function normalizeDailyCheckin(checkin = {}, options = {}) {
  const now = options.now ?? new Date().toISOString()
  const timezone = String(checkin.timezone ?? options.timezone ?? currentTimezone())
  const createdAt = checkin.createdAt ?? now
  return {
    id: checkin.id ?? randomId(),
    localDate: checkin.localDate ?? options.localDate ?? localDateKey(now, timezone),
    timezone,
    energy: optionalRating(checkin.energy),
    mood: optionalRating(checkin.mood),
    pressure: optionalRating(checkin.pressure),
    loadFeeling: CHECKIN_LOAD_FEELINGS.includes(checkin.loadFeeling) ? checkin.loadFeeling : null,
    contextCodes: normalizeContextCodes(checkin.contextCodes),
    note: String(checkin.note ?? '').trim().slice(0, NOTE_MAX_LENGTH),
    syncScope: CHECKIN_SYNC_SCOPES.includes(checkin.syncScope) ? checkin.syncScope : 'local_only',
    syncStatus: checkin.syncScope === 'cloud'
      ? (CHECKIN_SYNC_STATUSES.includes(checkin.syncStatus) ? checkin.syncStatus : 'pending')
      : 'local',
    syncError: checkin.syncScope === 'cloud' && checkin.syncError ? String(checkin.syncError) : null,
    clientOperationId: checkin.clientOperationId ?? randomId(),
    version: Math.max(1, Number(checkin.version) || 1),
    createdAt,
    updatedAt: checkin.updatedAt ?? createdAt,
    deletedAt: checkin.deletedAt ?? null,
  }
}

export function hasDailyCheckinContent(checkin) {
  return Boolean(
    checkin?.energy
    || checkin?.mood
    || checkin?.pressure
    || checkin?.loadFeeling
    || checkin?.contextCodes?.length
    || String(checkin?.note ?? '').trim()
  )
}

export function checkinLoadLabel(value) {
  return ({ light: 'Ligera', okay: 'Manejable', heavy: 'Pesada' })[value] ?? 'Sin indicar'
}

export function checkinEnergyLabel(value) {
  return ({ 1: 'Muy baja', 2: 'Baja', 3: 'Media', 4: 'Buena', 5: 'Alta' })[Number(value)] ?? 'Sin indicar'
}

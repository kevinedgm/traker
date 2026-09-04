import { storage } from '@services/storage'

const FEEDBACK_LIMIT = 100

export function readCopyState() {
  const raw = storage.read(storage.KEYS.COPY_STATE, null)
  if (!raw || typeof raw !== 'object') {
    return { recent: {}, globalRecent: [], disabled: [], favorites: [], feedback: [] }
  }
  return {
    recent: raw.recent && typeof raw.recent === 'object' ? raw.recent : {},
    globalRecent: Array.isArray(raw.globalRecent) ? raw.globalRecent : [],
    disabled: Array.isArray(raw.disabled) ? raw.disabled : [],
    favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
    feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
  }
}

export function writeCopyState(state) {
  storage.write(storage.KEYS.COPY_STATE, state)
}

/** Store only template id + verdict locally; never message text or context. */
export function recordCopyFeedback(phraseId, verdict, at = new Date().toISOString()) {
  if (!phraseId || !['helpful', 'not_helpful'].includes(verdict)) return null
  const state = readCopyState()
  const entry = { phraseId: String(phraseId), verdict, at }
  state.feedback = [...state.feedback, entry].slice(-FEEDBACK_LIMIT)
  writeCopyState(state)
  return entry
}

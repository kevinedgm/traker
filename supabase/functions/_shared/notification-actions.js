export const NOTIFICATION_ACTIONS = Object.freeze([
  Object.freeze({ action: 'done', title: 'Hecho' }),
  Object.freeze({ action: 'snooze', title: 'En 15 min' }),
  Object.freeze({ action: 'skip', title: 'Omitir' }),
])

export const NOTIFICATION_ACTION_IDS = Object.freeze(NOTIFICATION_ACTIONS.map(item => item.action))
export const SNOOZE_DELAY_MS = 15 * 60 * 1000

/** Direct actions only make sense for one concrete habit and remain opt-in. */
export function actionsForNotification({ kind, referenceIds = [], directActionsEnabled = false } = {}) {
  if (!directActionsEnabled || kind !== 'habit_or_block' || referenceIds.length !== 1) return []
  return NOTIFICATION_ACTIONS
}


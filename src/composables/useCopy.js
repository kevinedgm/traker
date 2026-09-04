/**
 * @file useCopy.js
 * Vue composable wrapping the pure copy engine (`@/features/copy/engine.js`)
 * with the app's actual state sources:
 *
 *  - Global tone preference: `settingsStore.tone`.
 *  - Per-habit override: `habit.copySettings` (category, toneOverride,
 *    carrillaEnabled, customPhrases, preferCustomPhrases, disabledEventIds).
 *  - Anti-repetition history + globally disabled/favorite phrase ids,
 *    persisted in localStorage under `storage.KEYS.COPY_STATE`.
 *
 * Usage:
 *   const { getPhrase } = useCopy()
 *   const { id, text } = getPhrase('habit_completed', { habit, vars: { habitName } })
 */
import { useSettingsStore } from '@stores/settings'
import { pickPhrase } from '@/features/copy/engine.js'
import { readCopyState, recordCopyFeedback, writeCopyState } from '@/features/copy/state.js'
import { features } from '@/config/features.js'

export function useCopy() {
  const settingsStore = useSettingsStore()

  /** Resolve the effective category/tone for a habit override (or the global default). */
  function resolveContext(habit) {
    const copySettings = habit?.copySettings ?? null
    const category = copySettings?.category || 'generic'
    // Kill switch: with the feature flag off, always use the plain 'normal'
    // tier — no catalog rewiring needed to disable the personality in prod.
    if (!features.copyPersonality) return { category, tone: 'normal', copySettings: null }
    let tone = copySettings?.toneOverride || settingsStore.tone || 'no_respect'
    // "Sin humor, texto plano" — force the calmest catalog tier for this habit.
    if (copySettings?.carrillaEnabled === false) tone = 'normal'
    return { category, tone, copySettings }
  }

  /**
   * Resolve a phrase for `event`.
   * @param {string} event
   * @param {{ category?: string, habit?: object, vars?: object, preview?: boolean }} [opts]
   *   `preview: true` skips writing the anti-repetition history (used by
   *   the "Previsualizar" button in CreateHabitModal).
   * @returns {{ id: string, text: string }}
   */
  function getPhrase(event, { category: categoryOverride, habit, vars = {}, preview = false } = {}) {
    const { category: habitCategory, tone, copySettings } = resolveContext(habit)
    const category = categoryOverride || habitCategory
    const state = readCopyState()
    const historyKey = `${event}:${category}`
    const recentIds = state.recent[historyKey] ?? []
    const disabledIds = [
      ...state.disabled,
      ...(Array.isArray(copySettings?.disabledEventIds) ? copySettings.disabledEventIds : []),
    ]

    const result = pickPhrase({
      event,
      category,
      tone,
      vars,
      recentIds,
      globalRecentIds: state.globalRecent,
      customPhrases: copySettings?.customPhrases ?? null,
      preferCustom: Boolean(copySettings?.preferCustomPhrases),
      disabledIds,
      favoriteIds: state.favorites,
    })

    if (!preview) {
      state.recent[historyKey] = result.recentIds
      state.globalRecent = result.globalRecentIds
      writeCopyState(state)
    }

    return result.phrase
  }

  /** Permanently hide a phrase id from future selection (global, all habits). */
  function disablePhrase(id) {
    if (!id) return
    const state = readCopyState()
    if (!state.disabled.includes(id)) {
      state.disabled.push(id)
      writeCopyState(state)
    }
  }

  /** Toggle a saved phrase. Saved phrases receive a bounded 2× selection weight. */
  function favoritePhrase(id) {
    if (!id) return
    const state = readCopyState()
    state.favorites = state.favorites.includes(id)
      ? state.favorites.filter(f => f !== id)
      : [...state.favorites, id]
    writeCopyState(state)
  }

  function isFavorite(id) {
    return readCopyState().favorites.includes(id)
  }

  return {
    getPhrase,
    disablePhrase,
    favoritePhrase,
    isFavorite,
    recordPhraseFeedback: recordCopyFeedback,
  }
}

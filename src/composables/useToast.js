/**
 * @file useToast.js
 * Centralized toast queue — module-level singleton state, same pattern
 * as `notifications.service.js`'s scheduler (module state, not a store).
 *
 * Replaces the per-page `ref` + `setTimeout` toast pattern that used to
 * live in DashboardPage.vue / HabitDetailPage.vue. Mount a single
 * `<ToastHost />` (see src/components/layout/ToastHost.vue) once, in
 * App.vue, and call `useToast().show(...)` from anywhere.
 */
import { reactive } from 'vue'

const state = reactive({ queue: [] })
let counter = 0
const timers = new Map()

/**
 * Show a toast.
 * @param {{ message: string, tone?: string, actionLabel?: string|null, onAction?: (() => void)|null, durationMs?: number }} options
 * @returns {number} toast id
 */
function show({ message, tone = 'neutral', actionLabel = null, onAction = null, durationMs = 4000 } = {}) {
  const id = ++counter
  state.queue.push({ id, message, tone, actionLabel, onAction })
  if (durationMs > 0) {
    const timer = setTimeout(() => dismiss(id), durationMs)
    timers.set(id, timer)
  }
  return id
}

function dismiss(id) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  // Mutate in place (splice), not `state.queue = state.queue.filter(...)` —
  // callers that destructured `queue` hold a reference to the original
  // reactive array, which a property reassignment would leave stale.
  const index = state.queue.findIndex(t => t.id === id)
  if (index !== -1) state.queue.splice(index, 1)
}

/** Run the toast's action callback (if any) and dismiss it. */
function action(id) {
  const toast = state.queue.find(t => t.id === id)
  toast?.onAction?.()
  dismiss(id)
}

export function useToast() {
  return { queue: state.queue, show, dismiss, action }
}

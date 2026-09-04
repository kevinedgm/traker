export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export class RequestTimeoutError extends Error {
  constructor(timeoutMs, options = {}) {
    super(`Request timed out after ${timeoutMs}ms`, options)
    this.name = 'RequestTimeoutError'
    this.code = 'request_timeout'
    this.timeoutMs = timeoutMs
  }
}

/**
 * Adds a hard ceiling to Supabase requests while preserving caller aborts.
 * Retries live at the durable sync-queue layer, never inside fetch, so a POST
 * is not duplicated invisibly.
 */
export function createTimedFetch(fetchImpl, {
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')

  return async function timedFetch(input, init = {}) {
    const safeTimeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
      ? Number(timeoutMs)
      : DEFAULT_REQUEST_TIMEOUT_MS
    const controller = new AbortController()
    const callerSignal = init.signal
    let timedOut = false

    const forwardCallerAbort = () => controller.abort(callerSignal?.reason)
    if (callerSignal?.aborted) forwardCallerAbort()
    else callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true })

    const timer = setTimer(() => {
      timedOut = true
      controller.abort()
    }, safeTimeout)

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal })
    } catch (error) {
      if (timedOut) throw new RequestTimeoutError(safeTimeout, { cause: error })
      throw error
    } finally {
      clearTimer(timer)
      callerSignal?.removeEventListener('abort', forwardCallerAbort)
    }
  }
}

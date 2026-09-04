export const SYNC_RETRY_DELAYS_MS = Object.freeze([1_000, 5_000, 15_000, 60_000])
export const MAX_AUTOMATIC_SYNC_RETRIES = SYNC_RETRY_DELAYS_MS.length

function numericStatus(error) {
  const candidate = error?.status ?? error?.statusCode ?? error?.context?.status
  const value = Number(candidate)
  return Number.isFinite(value) ? value : null
}

export function syncErrorCode(error) {
  const status = numericStatus(error)
  if (status) return String(status)
  if (error?.code) return String(error.code)
  if (error?.name) return String(error.name)
  return 'unknown_sync_error'
}

export function isTransientSyncError(error) {
  const status = numericStatus(error)
  if (status === 429 || (status >= 500 && status <= 599)) return true

  const code = String(error?.code ?? '').toLowerCase()
  const name = String(error?.name ?? '').toLowerCase()
  const message = String(error?.message ?? '').toLowerCase()
  return name === 'aborterror'
    || name === 'requesttimeouterror'
    || code === 'request_timeout'
    || code === 'etimedout'
    || code === 'econnreset'
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
}

export function nextSyncRetry(error, previousAttempts = 0, now = Date.now()) {
  const attempts = Math.max(0, Number(previousAttempts) || 0)
  if (!isTransientSyncError(error) || attempts >= MAX_AUTOMATIC_SYNC_RETRIES) return null
  const delayMs = SYNC_RETRY_DELAYS_MS[attempts]
  return {
    attempts: attempts + 1,
    delayMs,
    retryAt: new Date(now + delayMs).toISOString(),
    errorCode: syncErrorCode(error),
  }
}

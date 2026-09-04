export const MAX_NOTIFICATION_ATTEMPTS = 3

export function deliveryFailureDecision({
  status = 0,
  attempt = 1,
  expiresAt,
  now = new Date(),
  maxAttempts = MAX_NOTIFICATION_ATTEMPTS,
} = {}) {
  const providerStatus = Number(status) || 0
  if (providerStatus === 404 || providerStatus === 410) {
    return { action: 'invalidate', reason: 'invalid_subscription', retryAt: null }
  }

  const transient = providerStatus === 0 || providerStatus === 429 || providerStatus >= 500
  const nowMs = new Date(now).getTime()
  const expiresMs = new Date(expiresAt).getTime()
  if (transient && Number(attempt) < maxAttempts && expiresMs > nowMs) {
    const delayMinutes = 5 * 2 ** Math.max(0, Number(attempt) - 1)
    return {
      action: 'retry',
      reason: null,
      retryAt: new Date(nowMs + delayMinutes * 60_000).toISOString(),
    }
  }
  return {
    action: 'expire',
    reason: transient ? 'retry_limit' : 'permanent_provider_error',
    retryAt: null,
  }
}

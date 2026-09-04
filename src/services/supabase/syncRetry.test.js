import { describe, expect, it } from 'vitest'
import {
  isTransientSyncError,
  MAX_AUTOMATIC_SYNC_RETRIES,
  nextSyncRetry,
  SYNC_RETRY_DELAYS_MS,
} from './syncRetry.js'

describe('durable sync retry policy', () => {
  it.each([429, 500, 503, 599])('retries transient HTTP status %s', status => {
    expect(isTransientSyncError({ status })).toBe(true)
  })

  it.each([
    { name: 'AbortError' },
    { name: 'RequestTimeoutError', code: 'request_timeout' },
    { message: 'Failed to fetch' },
  ])('retries an aborted, slow or disconnected request', error => {
    expect(isTransientSyncError(error)).toBe(true)
  })

  it('does not automatically retry auth or validation failures', () => {
    expect(isTransientSyncError({ status: 400 })).toBe(false)
    expect(isTransientSyncError({ status: 401 })).toBe(false)
    expect(isTransientSyncError({ status: 403 })).toBe(false)
  })

  it('uses bounded backoff and leaves the operation queued after the ceiling', () => {
    const now = Date.parse('2026-09-01T06:00:00.000Z')
    expect(nextSyncRetry({ status: 503 }, 0, now)).toEqual({
      attempts: 1,
      delayMs: SYNC_RETRY_DELAYS_MS[0],
      retryAt: '2026-09-01T06:00:01.000Z',
      errorCode: '503',
    })
    expect(nextSyncRetry({ status: 503 }, MAX_AUTOMATIC_SYNC_RETRIES, now)).toBeNull()
  })
})

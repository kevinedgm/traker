import { describe, expect, it } from 'vitest'
import { deliveryFailureDecision } from './worker.js'

const NOW = '2026-08-29T14:00:00.000Z'
const EXPIRES = '2026-08-29T16:00:00.000Z'

describe('notification delivery failure policy', () => {
  it.each([404, 410])('invalidates a dead subscription on %s', status => {
    expect(deliveryFailureDecision({ status, attempt: 1, expiresAt: EXPIRES, now: NOW })).toMatchObject({
      action: 'invalidate',
      reason: 'invalid_subscription',
    })
  })

  it('retries a transient 5xx without completing the job', () => {
    expect(deliveryFailureDecision({ status: 503, attempt: 1, expiresAt: EXPIRES, now: NOW })).toEqual({
      action: 'retry',
      reason: null,
      retryAt: '2026-08-29T14:05:00.000Z',
    })
  })

  it('uses exponential backoff and stops at the attempt limit', () => {
    expect(deliveryFailureDecision({ status: 429, attempt: 2, expiresAt: EXPIRES, now: NOW }).retryAt)
      .toBe('2026-08-29T14:10:00.000Z')
    expect(deliveryFailureDecision({ status: 500, attempt: 3, expiresAt: EXPIRES, now: NOW })).toMatchObject({
      action: 'expire',
      reason: 'retry_limit',
    })
  })

  it('does not retry permanent provider errors or expired jobs', () => {
    expect(deliveryFailureDecision({ status: 400, attempt: 1, expiresAt: EXPIRES, now: NOW }).reason)
      .toBe('permanent_provider_error')
    expect(deliveryFailureDecision({ status: 0, attempt: 1, expiresAt: NOW, now: NOW }).action)
      .toBe('expire')
  })
})

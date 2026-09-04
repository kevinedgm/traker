import { describe, expect, it, vi } from 'vitest'
import { emitProductEvent, productDurationBucket } from './productAnalytics.service.js'

function clientResult(result) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))
  return { client: { from }, from, insert, select, single }
}

describe('content-free product analytics', () => {
  it('buckets durations without preserving precise timing', () => {
    expect(productDurationBucket(null)).toBeNull()
    expect(productDurationBucket(9_999)).toBe('under_10s')
    expect(productDurationBucket(10_000)).toBe('10s_to_60s')
    expect(productDurationBucket(60_000)).toBe('1m_to_5m')
    expect(productDurationBucket(300_000)).toBe('over_5m')
  })

  it('does not contact Supabase after consent is revoked', async () => {
    const sink = clientResult({ data: { id: 'event-1' }, error: null })
    const result = await emitProductEvent(
      { eventType: 'habit_log', durationMs: 12_000 },
      { consented: false, client: sink.client, userProvider: vi.fn() },
    )

    expect(result).toEqual({ status: 'skipped', reason: 'consent_required' })
    expect(sink.from).not.toHaveBeenCalled()
  })

  it('sends only the allowlisted event shape when consent is active', async () => {
    const sink = clientResult({ data: { id: 'event-1' }, error: null })
    const result = await emitProductEvent(
      { eventType: 'sync_conflict', durationMs: 72_000, errorCode: 'conflict' },
      { consented: true, client: sink.client, userProvider: async () => ({ id: 'user-1' }) },
    )

    expect(result).toEqual({ status: 'emitted', id: 'event-1' })
    expect(sink.from).toHaveBeenCalledWith('traker_product_events')
    expect(sink.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      event_type: 'sync_conflict',
      duration_bucket: '1m_to_5m',
      error_code: 'conflict',
    })
  })

  it('rejects arbitrary names and error strings before network access', async () => {
    await expect(emitProductEvent({ eventType: 'private_note' }, { consented: true })).rejects.toThrow('Unsupported product event')
    await expect(emitProductEvent({ eventType: 'activation', errorCode: 'raw-stack' }, { consented: true })).rejects.toThrow('Unsupported product error code')
  })
})


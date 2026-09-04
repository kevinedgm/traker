import { describe, expect, it, vi } from 'vitest'
import { createTimedFetch, RequestTimeoutError } from './timedFetch.js'

describe('timed Supabase fetch', () => {
  it('aborts a slow request at the configured ceiling', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const request = createTimedFetch(fetchImpl, { timeoutMs: 2_000 })('/rest/v1/habits')
    const rejection = expect(request).rejects.toBeInstanceOf(RequestTimeoutError)

    await vi.advanceTimersByTimeAsync(2_000)
    await rejection
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true)
    vi.useRealTimers()
  })

  it('preserves an abort requested by the caller', async () => {
    const caller = new AbortController()
    const fetchImpl = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const request = createTimedFetch(fetchImpl, { timeoutMs: 10_000 })(
      '/rest/v1/habits',
      { signal: caller.signal },
    )

    caller.abort('navigation')
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns ordinary responses and clears the timeout', async () => {
    const clearTimer = vi.fn(clearTimeout)
    const response = new Response('{}', { status: 200 })
    const fetchImpl = vi.fn().mockResolvedValue(response)

    await expect(createTimedFetch(fetchImpl, { clearTimer })('/rest/v1/habits')).resolves.toBe(response)
    expect(clearTimer).toHaveBeenCalledOnce()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const push = vi.fn()
vi.mock('@services/supabase/sync.service.js', () => ({ push }))

const { useCheckinsStore } = await import('./checkins.js')

describe('daily check-ins store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    push.mockResolvedValue(undefined)
  })

  it('keeps a new check-in local by default', () => {
    const store = useCheckinsStore()
    const saved = store.saveDailyCheckin({ loadFeeling: 'okay' }, '2026-08-29')
    expect(saved.syncScope).toBe('local_only')
    expect(store.forDate('2026-08-29')).toEqual(saved)
    expect(push).not.toHaveBeenCalled()
  })

  it('syncs only after explicit cloud scope', () => {
    const store = useCheckinsStore()
    const saved = store.saveDailyCheckin({ energy: 3, syncScope: 'cloud' }, '2026-08-29')
    expect(push).toHaveBeenCalledWith('upsert-checkin', { checkin: saved })
  })

  it('distinguishes requested sync from a confirmed cloud write', async () => {
    push.mockResolvedValue({ status: 'synced' })
    const store = useCheckinsStore()
    store.saveDailyCheckin({ energy: 3, syncScope: 'cloud' }, '2026-08-29')
    expect(store.forDate('2026-08-29').syncStatus).toBe('pending')
    await Promise.resolve()
    expect(store.forDate('2026-08-29').syncStatus).toBe('synced')
  })

  it('removes the remote copy when cloud scope is revoked', () => {
    const store = useCheckinsStore()
    store.saveDailyCheckin({ energy: 3, syncScope: 'cloud' }, '2026-08-29')
    push.mockClear()
    store.saveDailyCheckin({ energy: 2, syncScope: 'local_only' }, '2026-08-29')
    expect(push).toHaveBeenCalledWith('delete-checkin', expect.objectContaining({ localDate: '2026-08-29' }))
    expect(store.forDate('2026-08-29').energy).toBe(2)
  })

  it('does not overwrite a local-only record during cloud merge', () => {
    const store = useCheckinsStore()
    store.saveDailyCheckin({ mood: 2 }, '2026-08-29')
    store.mergeFromCloud([{
      localDate: '2026-08-29',
      mood: 5,
      syncScope: 'cloud',
      updatedAt: '2030-01-01T00:00:00Z',
    }])
    expect(store.forDate('2026-08-29').mood).toBe(2)
    expect(store.forDate('2026-08-29').syncScope).toBe('local_only')
  })

  it('clears local records and requests deletion of cloud-scoped copies', () => {
    const store = useCheckinsStore()
    store.saveDailyCheckin({ energy: 2 }, '2026-08-28')
    store.saveDailyCheckin({ energy: 3, syncScope: 'cloud' }, '2026-08-29')
    push.mockClear()
    store.clearAllCheckins()
    expect(store.checkins).toEqual([])
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('delete-checkin', expect.objectContaining({ localDate: '2026-08-29' }))
  })
})

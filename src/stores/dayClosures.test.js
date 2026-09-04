import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@services/supabase/sync.service.js', () => ({ push: vi.fn(() => Promise.resolve({ status: 'synced' })) }))

import { useDayClosuresStore } from './dayClosures.js'

describe('day closures store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps one editable closure per local date', () => {
    const store = useDayClosuresStore()
    store.closeDay({ localDate: '2026-08-31', state: 'moved', scheduled: 2, registered: 1, built: 1 })
    store.closeDay({ localDate: '2026-08-31', state: 'sufficient', scheduled: 2, registered: 2, built: 2 })
    expect(store.closures).toHaveLength(1)
    expect(store.forDate('2026-08-31').status).toBe('sufficient')
    expect(store.forDate('2026-08-31').version).toBe(2)
  })

  it('keeps the private tomorrow note when a newer cloud summary arrives', () => {
    const store = useDayClosuresStore()
    store.closeDay(
      { localDate: '2026-08-31', state: 'quiet', scheduled: 1, registered: 0, built: 0 },
      { tomorrowNote: 'Esto no debe salir del dispositivo', updatedAt: '2026-08-31T20:00:00.000Z' },
    )
    store.mergeFromCloud([{
      id: store.closures[0].id,
      localDate: '2026-08-31',
      status: 'moved',
      summary: { scheduled: 1, registered: 1, built: 1 },
      closedAt: '2026-08-31T20:00:00.000Z',
      updatedAt: '2026-08-31T21:00:00.000Z',
      version: 2,
    }])
    expect(store.closures[0].status).toBe('moved')
    expect(store.closures[0].tomorrowNote).toBe('Esto no debe salir del dispositivo')
  })
})

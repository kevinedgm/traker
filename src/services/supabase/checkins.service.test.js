import { describe, expect, it } from 'vitest'
import { fromRemoteCheckin, toRemoteCheckin } from './checkins.service.js'

const local = {
  id: '87882898-ad5d-46f1-a35e-ab1f4f2dd8d8',
  localDate: '2026-08-29',
  timezone: 'America/Mexico_City',
  energy: 2,
  mood: null,
  pressure: 4,
  loadFeeling: 'heavy',
  contextCodes: ['familia'],
  note: 'Hoy necesito menos carga',
  syncScope: 'cloud',
  clientOperationId: 'dfcb96d6-63ec-4249-bd27-b29574b0e4ad',
  version: 2,
  createdAt: '2026-08-29T12:00:00Z',
  updatedAt: '2026-08-29T13:00:00Z',
}

describe('Supabase daily check-in mappings', () => {
  it('maps optional context without persisting local privacy metadata', () => {
    expect(toRemoteCheckin(local, '16dc5e7e-42c7-4d8f-92dc-af0653f9f58b')).toMatchObject({
      local_date: '2026-08-29',
      energy: 2,
      mood: null,
      pressure: 4,
      load_feeling: 'heavy',
      context_codes: ['familia'],
      user_id: '16dc5e7e-42c7-4d8f-92dc-af0653f9f58b',
    })
    expect(toRemoteCheckin(local, 'user').sync_scope).toBeUndefined()
  })

  it('marks cloud rows as cloud-scoped when hydrating', () => {
    const checkin = fromRemoteCheckin({
      ...toRemoteCheckin(local, 'user'),
      updated_at: '2026-08-29T14:00:00Z',
    })
    expect(checkin.syncScope).toBe('cloud')
    expect(checkin.contextCodes).toEqual(['familia'])
    expect(checkin.updatedAt).toBe('2026-08-29T14:00:00Z')
  })
})

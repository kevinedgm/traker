import { describe, expect, it } from 'vitest'
import {
  checkinEnergyLabel,
  hasDailyCheckinContent,
  normalizeContextCodes,
  normalizeDailyCheckin,
} from './domain.js'

describe('daily check-in domain contract', () => {
  it('is private and optional by default', () => {
    const checkin = normalizeDailyCheckin({}, {
      now: '2026-08-29T14:00:00Z',
      timezone: 'America/Mexico_City',
    })
    expect(checkin.localDate).toBe('2026-08-29')
    expect(checkin.syncScope).toBe('local_only')
    expect(checkin.syncStatus).toBe('local')
    expect(checkin.energy).toBeNull()
    expect(hasDailyCheckinContent(checkin)).toBe(false)
  })

  it('drops invalid ratings and normalizes context', () => {
    const checkin = normalizeDailyCheckin({
      energy: 6,
      mood: '4',
      pressure: 0,
      loadFeeling: 'heavy',
      contextCodes: [' Trabajo ', 'trabajo', '', 'Familia'],
      note: '  Día movido  ',
      syncScope: 'cloud',
      syncStatus: 'synced',
    })
    expect(checkin).toMatchObject({
      energy: null,
      mood: 4,
      pressure: null,
      loadFeeling: 'heavy',
      contextCodes: ['trabajo', 'familia'],
      note: 'Día movido',
      syncScope: 'cloud',
      syncStatus: 'synced',
    })
    expect(hasDailyCheckinContent(checkin)).toBe(true)
  })

  it('deduplicates context and exposes neutral labels', () => {
    expect(normalizeContextCodes(['salud', 'SALUD', 'cambio'])).toEqual(['salud', 'cambio'])
    expect(checkinEnergyLabel(2)).toBe('Baja')
    expect(checkinEnergyLabel(null)).toBe('Sin indicar')
  })
})

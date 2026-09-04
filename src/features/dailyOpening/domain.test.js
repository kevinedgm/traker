import { describe, expect, it } from 'vitest'
import {
  DAILY_OPENING_SOURCE_TYPES,
  VERIFIED_DAILY_QUOTES,
  composeTodayOpening,
  isVerifiedQuote,
  selectDailyOpening,
} from './domain.js'

describe('daily opening domain', () => {
  it('selecciona el mismo mensaje público para la misma fecha local', () => {
    expect(selectDailyOpening('2026-08-31')).toEqual(selectDailyOpening('2026-08-31'))
  })

  it('mantiene el motivo personal separado y sin atribuirlo como cita', () => {
    const opening = composeTodayOpening({
      localDate: '2026-08-31',
      personalReason: 'Quiero tener energía para acompañar a mi familia.',
    })

    expect(opening.sourceType).toBe(DAILY_OPENING_SOURCE_TYPES.TRAKER)
    expect(opening.personalContext).toEqual({
      sourceType: DAILY_OPENING_SOURCE_TYPES.PERSONAL,
      sourceLabel: 'Tu motivo',
      text: 'Quiero tener energía para acompañar a mi familia.',
    })
    expect(opening.attribution).toBeNull()
  })

  it('no publica citas en el MVP y reasigna esos días a Traker', () => {
    expect(VERIFIED_DAILY_QUOTES).toHaveLength(0)
    for (let day = 1; day <= 31; day += 1) {
      const opening = selectDailyOpening(`2026-08-${String(day).padStart(2, '0')}`)
      expect(opening.sourceType).toBe(DAILY_OPENING_SOURCE_TYPES.TRAKER)
      expect(opening.sourceLabel).toBe('Mensaje de Traker')
    }
  })

  it('exige atribución, fuente y condición de uso antes de aceptar una cita', () => {
    const verified = {
      id: 'quote.test.01',
      sourceType: DAILY_OPENING_SOURCE_TYPES.QUOTE,
      text: 'Texto de prueba.',
      author: 'Autora de prueba',
      work: 'Obra de prueba',
      source: 'https://example.com/source',
      language: 'es',
      translation: '',
      theme: 'constancia',
      usageCondition: 'Dominio público',
    }

    expect(isVerifiedQuote(verified)).toBe(true)
    expect(isVerifiedQuote({ ...verified, source: '' })).toBe(false)
    expect(isVerifiedQuote({ ...verified, author: '' })).toBe(false)
    expect(isVerifiedQuote({ ...verified, usageCondition: '' })).toBe(false)
  })

  it('adjunta versión y snapshot editorial al resultado', () => {
    const opening = selectDailyOpening('2026-08-31')
    expect(opening.catalogVersion).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d+$/)
    expect(opening.catalogHash).toBe('traker-copy-4c-v1')
  })
})

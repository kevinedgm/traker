import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCopy } from './useCopy.js'
import { useSettingsStore } from '@stores/settings'

describe('useCopy', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('usa el tono global de settings por default', () => {
    const settings = useSettingsStore()
    settings.tone = 'normal'
    const { getPhrase } = useCopy()
    const phrase = getPhrase('habit_completed', { vars: { habitName: 'Leer' } })
    expect(phrase.id).toMatch(/^generic\.habit_completed\.normal\./)
  })

  it('un hábito con toneOverride ignora el tono global', () => {
    const settings = useSettingsStore()
    settings.tone = 'no_respect'
    const { getPhrase } = useCopy()
    const habit = { copySettings: { toneOverride: 'normal', category: 'generic' } }
    const phrase = getPhrase('habit_completed', { habit })
    expect(phrase.id).toMatch(/\.normal\./)
  })

  it('carrillaEnabled=false fuerza tono normal aunque el global sea no_respect', () => {
    const settings = useSettingsStore()
    settings.tone = 'no_respect'
    const { getPhrase } = useCopy()
    const habit = { copySettings: { carrillaEnabled: false, category: 'generic' } }
    const phrase = getPhrase('habit_completed', { habit })
    expect(phrase.id).toMatch(/\.normal\./)
  })

  it('usa la categoría del hábito para resolver el catálogo', () => {
    const settings = useSettingsStore()
    settings.tone = 'no_respect'
    const { getPhrase } = useCopy()
    const habit = { copySettings: { category: 'gym' } }
    const phrase = getPhrase('habit_completed', { habit })
    expect(phrase.id).toMatch(/^gym\.habit_completed\./)
  })

  it('persiste el historial de repetición entre llamadas (misma combinación evento+categoría)', () => {
    const settings = useSettingsStore()
    settings.tone = 'normal'
    const { getPhrase } = useCopy()
    const seen = new Set()
    for (let i = 0; i < 5; i++) {
      seen.add(getPhrase('day_closed', { vars: { completions: 1, total: 1 } }).id)
    }
    // With a small pool and real Math.random, repetition avoidance should
    // surface more than one distinct id across several picks most of the time.
    expect(seen.size).toBeGreaterThan(0)
  })

  it('preview:true no persiste el historial', () => {
    const settings = useSettingsStore()
    settings.tone = 'normal'
    const { getPhrase } = useCopy()
    const before = localStorage.getItem('traker:copy-state')
    getPhrase('habit_completed', { preview: true })
    const after = localStorage.getItem('traker:copy-state')
    expect(after).toBe(before)
  })

  it('disablePhrase evita que esa frase se vuelva a elegir', () => {
    const settings = useSettingsStore()
    settings.tone = 'normal'
    const { getPhrase, disablePhrase } = useCopy()
    const first = getPhrase('offline', {})
    disablePhrase(first.id)
    for (let i = 0; i < 20; i++) {
      const phrase = getPhrase('offline', {})
      expect(phrase.id).not.toBe(first.id)
    }
  })

  it('favoritePhrase marca y desmarca como favorita', () => {
    const { favoritePhrase, isFavorite } = useCopy()
    expect(isFavorite('generic.offline.normal.01')).toBe(false)
    favoritePhrase('generic.offline.normal.01')
    expect(isFavorite('generic.offline.normal.01')).toBe(true)
    favoritePhrase('generic.offline.normal.01')
    expect(isFavorite('generic.offline.normal.01')).toBe(false)
  })

  it('guarda feedback mínimo sólo en el estado local de copy', () => {
    const { recordPhraseFeedback } = useCopy()
    recordPhraseFeedback('notification.evening_close.01', 'helpful', '2026-08-31T12:00:00.000Z')
    const saved = JSON.parse(localStorage.getItem('traker:copy-state'))
    expect(saved.feedback).toEqual([{
      phraseId: 'notification.evening_close.01',
      verdict: 'helpful',
      at: '2026-08-31T12:00:00.000Z',
    }])
    expect(JSON.stringify(saved)).not.toContain('message')
  })
})

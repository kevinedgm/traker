import { describe, expect, it } from 'vitest'
import { pickPhrase, interpolate, GLOBAL_RECENT_LIMIT, RECENT_LIMIT } from './engine.js'
import { CATEGORIES, CATEGORY_EVENTS, EVENT_FALLBACKS, FALLBACK_PHRASE, GENERIC_EVENTS, SENSITIVE_CATEGORIES } from './catalog.js'

/** Deterministic rng: always returns 0, so the engine always picks index 0. */
function rngZero() { return 0 }

/** Deterministic rng sequence, one value consumed per call. */
function rngSequence(values) {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('pickPhrase — selección por evento/categoría/tono', () => {
  it('selecciona del pool genérico cuando no hay categoría específica', () => {
    const { phrase } = pickPhrase({ event: 'habit_completed', category: 'generic', tone: 'normal', rng: rngZero })
    expect(GENERIC_EVENTS.habit_completed.normal.map(p => p.id)).toContain(phrase.id)
  })

  it('prioriza el pool de categoría sobre el genérico cuando existe', () => {
    const { phrase } = pickPhrase({ event: 'habit_completed', category: 'gym', tone: 'no_respect', rng: rngZero })
    expect(CATEGORY_EVENTS.gym.habit_completed.no_respect.map(p => p.id)).toContain(phrase.id)
  })

  it('respeta el tono solicitado cuando existe contenido para ese tono', () => {
    const { phrase } = pickPhrase({ event: 'habit_reminder', category: 'generic', tone: 'trusted', rng: rngZero })
    expect(GENERIC_EVENTS.habit_reminder.trusted.map(p => p.id)).toContain(phrase.id)
  })
})

describe('pickPhrase — prioridad de frases personalizadas', () => {
  const customPhrases = { habit_completed: ['Frase propia uno', 'Frase propia dos'] }

  it('usa el catálogo si preferCustom es false y el catálogo tiene contenido', () => {
    const { usingCustom } = pickPhrase({
      event: 'habit_completed', category: 'generic', tone: 'normal',
      customPhrases, preferCustom: false, rng: rngZero,
    })
    expect(usingCustom).toBe(false)
  })

  it('usa las personalizadas cuando preferCustom es true', () => {
    const { usingCustom, phrase } = pickPhrase({
      event: 'habit_completed', category: 'generic', tone: 'normal',
      customPhrases, preferCustom: true, rng: rngZero,
    })
    expect(usingCustom).toBe(true)
    expect(phrase.text).toBe('Frase propia uno')
  })

  it('usa las personalizadas si el catálogo para esa combinación está vacío', () => {
    const { usingCustom, phrase } = pickPhrase({
      event: 'this_event_has_no_catalog_content', category: 'generic', tone: 'no_respect',
      customPhrases: { this_event_has_no_catalog_content: ['Frase propia sin catálogo.'] },
      preferCustom: false, rng: rngZero,
    })
    expect(usingCustom).toBe(true)
    expect(phrase.text).toBe('Frase propia sin catálogo.')
  })
})

describe('pickPhrase — no-repetición y reseteo de historial', () => {
  it('no repite un id que está en recentIds si hay alternativas', () => {
    const pool = GENERIC_EVENTS.offline.normal
    const recentIds = [pool[0].id]
    const { phrase } = pickPhrase({
      event: 'offline', category: 'generic', tone: 'normal',
      recentIds, rng: rngZero,
    })
    expect(phrase.id).not.toBe(pool[0].id)
  })

  it('acumula recentIds hasta RECENT_LIMIT (ring buffer)', () => {
    let recentIds = []
    const pool = GENERIC_EVENTS.day_closed.normal
    for (let i = 0; i < RECENT_LIMIT + 3; i++) {
      const result = pickPhrase({
        event: 'day_closed', category: 'generic', tone: 'normal',
        recentIds, rng: rngSequence([i / pool.length]),
      })
      recentIds = result.recentIds
    }
    expect(recentIds.length).toBeLessThanOrEqual(RECENT_LIMIT)
  })

  it('evita también los últimos mensajes globales cuando hay alternativas', () => {
    const pool = GENERIC_EVENTS.offline.normal
    const { phrase, globalRecentIds } = pickPhrase({
      event: 'offline', category: 'generic', tone: 'normal',
      globalRecentIds: [pool[0].id], rng: rngZero,
    })
    expect(phrase.id).not.toBe(pool[0].id)
    expect(globalRecentIds).toHaveLength(2)
    expect(globalRecentIds.length).toBeLessThanOrEqual(GLOBAL_RECENT_LIMIT)
  })

  it('resetea el historial de la combinación cuando el pool filtrado queda vacío', () => {
    const pool = GENERIC_EVENTS.offline.normal
    const recentIds = pool.map(p => p.id) // every id already "recent"
    const { phrase, recentIds: nextRecentIds } = pickPhrase({
      event: 'offline', category: 'generic', tone: 'normal',
      recentIds, rng: rngZero,
    })
    // Still picks something valid from the pool (history ignored, not stuck).
    expect(pool.map(p => p.id)).toContain(phrase.id)
    expect(nextRecentIds.length).toBeGreaterThan(0)
  })
})

describe('pickPhrase — fallback en cascada', () => {
  it('cae al genérico cuando la categoría no tiene ese evento', () => {
    const { phrase } = pickPhrase({ event: 'too_many_goals', category: 'gym', tone: 'no_respect', rng: rngZero })
    expect(GENERIC_EVENTS.too_many_goals.no_respect.map(p => p.id)).toContain(phrase.id)
  })

  it('cae a tono normal cuando el tono pedido no existe para ese evento', () => {
    const { phrase } = pickPhrase({ event: 'offline', category: 'generic', tone: 'no_respect', rng: rngZero })
    expect(GENERIC_EVENTS.offline.normal.map(p => p.id)).toContain(phrase.id)
  })

  it('usa la frase fija de emergencia si todo está vacío (catálogo y personalizadas)', () => {
    const { phrase } = pickPhrase({
      event: 'this_event_does_not_exist', category: 'generic', tone: 'no_respect', rng: rngZero,
    })
    expect(phrase.id).toBe(FALLBACK_PHRASE.id)
    expect(phrase.text).toBe(FALLBACK_PHRASE.text)
  })
})

describe('pickPhrase — degradación en categorías sensibles', () => {
  it('degrada no_respect a trusted para frases de catálogo en categorías sensibles', () => {
    const { phrase } = pickPhrase({ event: 'habit_reminder', category: 'medication', tone: 'no_respect', rng: rngZero })
    const trustedIds = CATEGORY_EVENTS.medication.habit_reminder.trusted.map(p => p.id)
    expect(trustedIds).toContain(phrase.id)
  })

  it.each(['offline', 'sync_error', 'generic_error'])('fuerza tono neutral para %s', event => {
    const { phrase } = pickPhrase({ event, category: 'generic', tone: 'no_respect', rng: rngZero })
    expect(phrase.id).toMatch(new RegExp(`^generic\\.${event}\\.normal\\.`))
  })

  it.each(['family', 'health', 'finance', 'work'])('incluye %s y bloquea tono alto', category => {
    expect(CATEGORIES).toContain(category)
    expect(SENSITIVE_CATEGORIES.has(category)).toBe(true)
    const { phrase } = pickPhrase({ event: 'habit_reminder', category, tone: 'no_respect', rng: rngZero })
    expect(phrase.id).toMatch(/^generic\.habit_reminder\.trusted\./)
  })

  it('no degrada las frases personalizadas del usuario en categorías sensibles', () => {
    const { phrase, usingCustom } = pickPhrase({
      event: 'habit_reminder', category: 'medication', tone: 'no_respect',
      customPhrases: { habit_reminder: ['Órale, pastilla va.'] },
      preferCustom: true, rng: rngZero,
    })
    expect(usingCustom).toBe(true)
    expect(phrase.text).toBe('Órale, pastilla va.')
  })
})

describe('interpolate — sustitución segura por whitelist', () => {
  it('sustituye variables permitidas para el evento', () => {
    const text = interpolate('Hora de {habitName}, van {hour}.', 'habit_reminder', { habitName: 'Correr', hour: '08:00' })
    expect(text).toBe('Hora de Correr, van 08:00.')
  })

  it('ignora variables no incluidas en el whitelist del evento', () => {
    // 'offline' has no whitelisted vars — {habitName} must survive untouched.
    const text = interpolate('Sin conexión, {habitName}.', 'offline', { habitName: 'Correr' })
    expect(text).toBe('Sin conexión, {habitName}.')
  })

  it('reemplaza variables faltantes con cadena vacía y limpia espacios dobles', () => {
    const text = interpolate('Hora de {habitName} ahora.', 'habit_completed', {})
    expect(text).toBe('Hora de ahora.')
  })
})

describe('pickPhrase — catálogo vacío o todo desactivado', () => {
  it('usa un fallback neutral separado si el pool completo está desactivado', () => {
    const pool = GENERIC_EVENTS.offline.normal
    const disabledIds = pool.map(p => p.id)
    const { phrase } = pickPhrase({
      event: 'offline', category: 'generic', tone: 'normal', disabledIds, rng: rngZero,
    })
    expect(phrase).toEqual(EVENT_FALLBACKS.offline)
    expect(disabledIds).not.toContain(phrase.id)
  })

  it('da a una frase guardada un peso 2× sin volverla exclusiva', () => {
    const pool = GENERIC_EVENTS.offline.normal
    const favoriteId = pool[0].id
    const weightedLength = pool.length + 1
    const picked = Array.from({ length: weightedLength }, (_, index) => pickPhrase({
      event: 'offline', category: 'generic', tone: 'normal',
      favoriteIds: [favoriteId], rng: () => (index + 0.01) / weightedLength,
    }).phrase.id)
    expect(picked.filter(id => id === favoriteId)).toHaveLength(2)
    expect(new Set(picked).size).toBe(pool.length)
  })

  it('cubre los eventos funcionales del ciclo diario, metas, sesiones y errores', () => {
    expect(Object.keys(GENERIC_EVENTS)).toEqual(expect.arrayContaining([
      'habit_partial', 'habit_paused', 'habit_returned', 'goal_paused',
      'goal_returned', 'goal_reformulated', 'goal_closed', 'session_completed',
      'evening_summary', 'sync_error', 'generic_error',
    ]))
  })

  it('interpola el texto de la frase elegida', () => {
    const { phrase } = pickPhrase({
      event: 'habit_completed', category: 'generic', tone: 'normal',
      vars: { habitName: 'Leer' }, rng: rngZero,
    })
    expect(phrase.text).not.toMatch(/\{habitName\}/)
    expect(phrase.text).toContain('Leer')
  })
})

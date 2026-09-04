import { describe, expect, it } from 'vitest'
import { closureCopy, normalizeDayClosure, summarizeDay } from './domain.js'

const date = new Date('2026-08-31T18:00:00Z')
const habit = (id, level) => ({
  id,
  isActive: true,
  createdAt: '2026-08-31T08:00:00-06:00',
  schedule: {
    id: `schedule-${id}`,
    kind: 'weekdays',
    timezone: 'America/Mexico_City',
    daysOfWeek: [1],
    effectiveFrom: '2026-08-31',
    isActive: true,
  },
  logs: level === undefined ? {} : { 1: { level } },
})

describe('today closure domain', () => {
  it('treats minimum and adapted versions as sufficient without requiring full completion', () => {
    const summary = summarizeDay([habit('a', 1), habit('b', 2)], date)
    expect(summary).toMatchObject({ scheduled: 2, built: 2, complete: 0, adapted: 2, isSufficient: true, state: 'sufficient' })
  })

  it('closes partial movement without turning missing entries into debt', () => {
    const summary = summarizeDay([habit('a', 1), habit('b')], date)
    expect(summary).toMatchObject({ built: 1, unregistered: 1, isSufficient: false, state: 'moved' })
    expect(closureCopy(summary).title).toBe('Lo que sí pasó queda guardado.')
  })

  it('supports a neutral close when nothing moved', () => {
    const summary = summarizeDay([habit('a'), habit('b', 0)], date)
    const closure = normalizeDayClosure({ tomorrowNote: '  Empezar pequeño  ' }, summary)
    expect(closure.status).toBe('quiet')
    expect(closure.tomorrowNote).toBe('Empezar pequeño')
    expect(closureCopy(summary).body).toContain('Mañana podrás elegir de nuevo')
  })

  it('allows a day without scheduled minimums to close as sufficient', () => {
    const summary = summarizeDay([], date)
    expect(summary).toMatchObject({ scheduled: 0, built: 0, isSufficient: true, state: 'sufficient' })
    expect(closureCopy(summary).title).toBe('Hoy no hay mínimos programados.')
  })

  it('keeps flexible alternatives out of daily debt while reporting period progress', () => {
    const flexibleHabit = habit('flex-a', 3)
    flexibleHabit.logs[1].localDate = '2026-08-31'
    const summary = summarizeDay([flexibleHabit, habit('required')], date, {
      excludedHabitIds: new Set(['flex-a']),
      flexibleGroups: [{ id: 'group-1', name: 'Movimiento', minimumCount: 2, memberIds: ['flex-a'] }],
    })

    expect(summary).toMatchObject({ scheduled: 1, unregistered: 1 })
    expect(summary.flexibleGroups[0]).toMatchObject({ built: 1, minimum: 1, isMinimumMet: true })
    const closure = normalizeDayClosure({}, summary)
    expect(closure.summary.flexibleGroups[0]).toMatchObject({ name: 'Movimiento', built: 1 })
  })
})

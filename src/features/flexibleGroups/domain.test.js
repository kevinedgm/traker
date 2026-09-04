import { describe, expect, it } from 'vitest'
import {
  buildFlexibleAgenda,
  flexibleGroupProgress,
  normalizeFlexibleGroup,
} from './domain.js'

const habits = [
  {
    id: 'walk',
    name: 'Caminar',
    isActive: true,
    createdAt: '2026-08-24T08:00:00-06:00',
    schedule: { timezone: 'America/Mexico_City' },
    logs: { 1: { level: 3, localDate: '2026-08-24' } },
  },
  {
    id: 'stretch',
    name: 'Estirar',
    isActive: true,
    createdAt: '2026-08-24T08:00:00-06:00',
    schedule: { timezone: 'America/Mexico_City' },
    logs: { 2: { level: 1, localDate: '2026-08-25' }, 3: { level: 3, localDate: '2026-08-26' } },
  },
]

describe('flexible groups domain', () => {
  it('normalizes bounds without allowing a minimum above the available choices', () => {
    expect(normalizeFlexibleGroup({
      name: ' Movimiento ',
      minimumCount: 8,
      memberIds: ['walk', 'walk', 'stretch'],
    })).toMatchObject({ name: 'Movimiento', minimumCount: 2, memberIds: ['walk', 'stretch'] })
  })

  it('counts distinct activities once per period', () => {
    const progress = flexibleGroupProgress({
      id: 'movement',
      name: 'Movimiento',
      period: 'week',
      minimumCount: 2,
      memberIds: ['walk', 'stretch'],
    }, habits, new Date('2026-08-26T18:00:00Z'))

    expect(progress).toMatchObject({ built: 2, remaining: 0, isMinimumMet: true })
    expect(progress.completedHabitIds).toEqual(['walk', 'stretch'])
  })

  it('deduplicates a habit shared by several groups in the Today agenda', () => {
    const agenda = buildFlexibleAgenda([
      { id: 'movement', name: 'Movimiento', memberIds: ['walk', 'stretch'] },
      { id: 'outside', name: 'Salir', memberIds: ['walk'] },
    ], habits, new Date('2026-08-26T18:00:00Z'))

    expect(agenda.options.map(option => option.habit.id)).toEqual(['walk', 'stretch'])
    expect(agenda.options.find(option => option.habit.id === 'walk').groupNames).toEqual(['Movimiento', 'Salir'])
  })
})

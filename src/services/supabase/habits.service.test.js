import { describe, expect, it } from 'vitest'
import { fromRemoteSchedule, toRemoteHabit, toRemoteHabitLog, toRemoteSchedule } from './habits.service.js'

const habit = {
  id: '2a3ed4b9-8bcf-463d-89fe-75f5f3f19be1',
  name: 'Leer con calma',
  minimumVersion: 'Leer dos páginas',
  goalIds: ['a76557dc-f114-42e9-91f2-6574be434e9b', '8144973a-af48-48b6-b54a-886a7f454c11'],
  icon: 'BookOpen',
  color: '#6C8CFF',
  duration: 30,
  isActive: true,
  reminder: '20:00',
  createdAt: '2026-08-28T12:00:00Z',
  updatedAt: '2026-08-28T12:00:00Z',
  schedule: {
    id: 'c6487351-08ab-4ad1-bd8c-b76bef37f76b',
    timezone: 'America/Mexico_City',
    daysOfWeek: [1, 3, 5],
    effectiveFrom: '2026-08-28',
    isActive: true,
    version: 1,
  },
}

describe('Supabase habit mappings', () => {
  it('keeps relationships and weekdays out of the canonical habit row', () => {
    const row = toRemoteHabit(habit, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')
    expect(row).not.toHaveProperty('linked_goal_id')
    expect(row).not.toHaveProperty('reminder_days')
    expect(row.minimum_version).toBe(habit.minimumVersion)
    expect(row.lifecycle_status).toBe('active')
  })

  it('maps the local calendar to the canonical schedule row', () => {
    expect(toRemoteSchedule(habit, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')).toMatchObject({
      habit_id: habit.id,
      kind: 'weekdays',
      days_of_week: [1, 3, 5],
      effective_from: '2026-08-28',
    })
  })

  it('maps weekly targets and clears unrelated schedule payloads', () => {
    const row = toRemoteSchedule({
      ...habit,
      schedule: {
        ...habit.schedule,
        kind: 'times_per_week',
        daysOfWeek: null,
        periodMinimum: 3,
        periodTarget: 4,
        periodExtra: 5,
      },
    }, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')

    expect(row).toMatchObject({
      kind: 'times_per_week',
      days_of_week: null,
      period_minimum: 3,
      period_target: 4,
      period_extra: 5,
      interval_days: null,
    })
  })

  it('maps interval and window schedules without collapsing their kind', () => {
    expect(toRemoteSchedule({
      ...habit,
      schedule: { ...habit.schedule, kind: 'every_n_days', intervalDays: 3 },
    }, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')).toMatchObject({
      kind: 'every_n_days', interval_days: 3, days_of_week: null,
    })
    expect(toRemoteSchedule({
      ...habit,
      schedule: { ...habit.schedule, kind: 'window', windowStart: '09:00', windowEnd: '17:30' },
    }, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')).toMatchObject({
      kind: 'window', window_start: '09:00', window_end: '17:30', days_of_week: null,
    })
  })

  it('hydrates every schedule field from the canonical row', () => {
    expect(fromRemoteSchedule({
      id: 'schedule-weekly',
      kind: 'times_per_week',
      timezone: 'America/Mexico_City',
      days_of_week: null,
      interval_days: null,
      period_minimum: 3,
      period_target: 4,
      period_extra: 5,
      window_start: null,
      window_end: null,
      effective_from: '2026-08-31',
      effective_to: null,
      is_active: true,
      version: 2,
    })).toMatchObject({
      id: 'schedule-weekly',
      kind: 'times_per_week',
      periodMinimum: 3,
      periodTarget: 4,
      periodExtra: 5,
      version: 2,
    })

    expect(fromRemoteSchedule({
      id: 'schedule-window',
      kind: 'window',
      timezone: 'America/Mexico_City',
      window_start: '20:00:00',
      window_end: '02:00:00',
      effective_from: '2026-08-31',
      is_active: true,
      version: 1,
    })).toMatchObject({ kind: 'window', windowStart: '20:00', windowEnd: '02:00' })
  })

  it('maps a minimum registration to a partial canonical log', () => {
    const row = toRemoteHabitLog(habit.id, {
      id: '8a6fc24c-9aad-4754-9466-5831fb18871d',
      clientOperationId: '092af6fc-67f0-45a7-b0d0-e511ac8d9f09',
      localDate: '2026-08-28',
      timezone: 'America/Mexico_City',
      occurrenceKey: 'date:2026-08-28',
      level: 1,
      emotion: 'calm',
      energy: 'medium',
      note: 'Empecé pequeño',
      loggedAt: '2026-08-28T20:00:00Z',
      version: 1,
    }, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')
    expect(row.status).toBe('partial')
    expect(row.minimum_used).toBe(true)
    expect(row.context_codes).toEqual(['emotion:calm', 'energy:medium'])
  })

  it('prefers canonical outcome fields and preserves optional context codes', () => {
    const row = toRemoteHabitLog(habit.id, {
      id: '8a6fc24c-9aad-4754-9466-5831fb18871d',
      clientOperationId: '092af6fc-67f0-45a7-b0d0-e511ac8d9f09',
      localDate: '2026-08-28',
      status: 'conscious_skip',
      minimumUsed: true,
      level: 3,
      contextCodes: ['work', 'work'],
      emotion: 'calm',
      loggedAt: '2026-08-28T20:00:00Z',
      version: 2,
    }, 'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58')

    expect(row).toMatchObject({ status: 'conscious_skip', minimum_used: false, context_codes: ['work', 'emotion:calm'] })
  })

  it('does not write legacy provenance into a canonical log', () => {
    const log = {
      id: '8a6fc24c-9aad-4754-9466-5831fb18871d',
      clientOperationId: '092af6fc-67f0-45a7-b0d0-e511ac8d9f09',
      localDate: '2026-08-28',
      level: 3,
      loggedAt: '2026-08-28T20:00:00Z',
    }
    const row = toRemoteHabitLog(
      habit.id,
      log,
      'f77f5500-e02a-4f94-b9ce-f4f0a6c2fa58',
    )

    expect(row).not.toHaveProperty('legacy_entry_id')
    expect(row).not.toHaveProperty('legacy_day_number')
    expect(row).not.toHaveProperty('legacy_level')
  })
})

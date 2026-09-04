import { describe, expect, it } from 'vitest'
import {
  dayNumberForLocalDate,
  isHabitScheduledForDate,
  habitScheduleLabel,
  localDateForDay,
  logLevelForStatus,
  logStatusForLevel,
  normalizeHabitLogOutcome,
  normalizeGoalIds,
  normalizeHabitLog,
  normalizeHabitSchedule,
  normalizeScheduleDays,
  scheduleProgressForDate,
} from './domain.js'

describe('habit domain contract', () => {
  it('normalizes goal links and keeps the legacy single link', () => {
    expect(normalizeGoalIds(['goal-b', 'goal-a', 'goal-b'])).toEqual(['goal-b', 'goal-a'])
    expect(normalizeGoalIds(undefined, 'legacy-goal')).toEqual(['legacy-goal'])
  })

  it('normalizes weekdays in the Monday-to-Sunday order', () => {
    expect(normalizeScheduleDays([0, 5, 1, 5, 9])).toEqual([1, 5, 0])
  })

  it('recovers from an invalid stored timezone', () => {
    expect(localDateForDay('2026-08-27T10:00:00-06:00', 1, 'Invalid/Zone')).toBe('2026-08-27')
  })

  it('only includes a habit on configured calendar days', () => {
    const habit = {
      isActive: true,
      createdAt: '2026-08-01T12:00:00Z',
      schedule: {
        id: 'schedule-1',
        kind: 'weekdays',
        timezone: 'America/Mexico_City',
        daysOfWeek: [1, 3, 5],
        effectiveFrom: '2026-08-01',
        isActive: true,
      },
    }
    expect(isHabitScheduledForDate(habit, new Date('2026-08-28T18:00:00Z'))).toBe(true)
    expect(isHabitScheduledForDate(habit, new Date('2026-08-29T18:00:00Z'))).toBe(false)
  })

  it('preserves every canonical schedule kind instead of collapsing to weekdays', () => {
    expect(normalizeHabitSchedule({ kind: 'times_per_week', periodMinimum: 3, periodTarget: 4, periodExtra: 5 })).toMatchObject({
      kind: 'times_per_week', periodMinimum: 3, periodTarget: 4, periodExtra: 5, daysOfWeek: null,
    })
    expect(normalizeHabitSchedule({ kind: 'times_per_month', periodMinimum: 8 })).toMatchObject({
      kind: 'times_per_month', periodMinimum: 8,
    })
    expect(normalizeHabitSchedule({ kind: 'every_n_days', intervalDays: 4 })).toMatchObject({
      kind: 'every_n_days', intervalDays: 4,
    })
    expect(normalizeHabitSchedule({ kind: 'window', windowStart: '09:30', windowEnd: '18:00' })).toMatchObject({
      kind: 'window', windowStart: '09:30', windowEnd: '18:00',
    })
  })

  it('shows a weekly-frequency habit until its minimum is met without carrying debt', () => {
    const habit = {
      createdAt: '2026-08-31T08:00:00-06:00',
      isActive: true,
      schedule: {
        kind: 'times_per_week', timezone: 'America/Mexico_City', effectiveFrom: '2026-08-31',
        periodMinimum: 3, periodTarget: 4, periodExtra: 5, isActive: true,
      },
      logs: {
        1: { localDate: '2026-08-31', level: 3 },
        2: { localDate: '2026-09-01', level: 1 },
      },
    }

    expect(isHabitScheduledForDate(habit, new Date('2026-09-02T18:00:00Z'))).toBe(true)
    habit.logs[3] = { localDate: '2026-09-02', level: 2 }
    expect(scheduleProgressForDate(habit, new Date('2026-09-02T18:00:00Z'))).toMatchObject({ built: 3, remaining: 0, isMinimumMet: true })
    expect(isHabitScheduledForDate(habit, new Date('2026-09-02T18:00:00Z'))).toBe(true)
    expect(isHabitScheduledForDate(habit, new Date('2026-09-03T18:00:00Z'))).toBe(false)
    expect(isHabitScheduledForDate(habit, new Date('2026-09-07T18:00:00Z'))).toBe(true)
  })

  it('resolves monthly, interval and daily-window schedules from local dates', () => {
    const base = { createdAt: '2026-08-31T08:00:00-06:00', isActive: true, logs: {} }
    const monthly = { ...base, schedule: { kind: 'times_per_month', timezone: 'America/Mexico_City', effectiveFrom: '2026-08-31', periodMinimum: 2 } }
    const interval = { ...base, schedule: { kind: 'every_n_days', timezone: 'America/Mexico_City', effectiveFrom: '2026-08-31', intervalDays: 3 } }
    const window = { ...base, schedule: { kind: 'window', timezone: 'America/Mexico_City', effectiveFrom: '2026-08-31', windowStart: '10:00', windowEnd: '16:00' } }

    expect(isHabitScheduledForDate(monthly, new Date('2026-09-15T18:00:00Z'))).toBe(true)
    expect(isHabitScheduledForDate(interval, new Date('2026-09-03T18:00:00Z'))).toBe(true)
    expect(isHabitScheduledForDate(interval, new Date('2026-09-04T18:00:00Z'))).toBe(false)
    expect(isHabitScheduledForDate(window, new Date('2026-09-04T18:00:00Z'))).toBe(true)
    expect(habitScheduleLabel(window)).toBe('Ventana 10:00–16:00')
  })

  it('uses the schedule timezone across a UTC date boundary', () => {
    const habit = {
      createdAt: '2026-08-30T08:00:00-06:00',
      isActive: true,
      schedule: { kind: 'weekdays', timezone: 'America/Mexico_City', effectiveFrom: '2026-08-30', daysOfWeek: [1] },
    }
    expect(isHabitScheduledForDate(habit, new Date('2026-08-31T03:00:00Z'))).toBe(false)
    expect(isHabitScheduledForDate(habit, new Date('2026-08-31T18:00:00Z'))).toBe(true)
  })

  it('does not count registrations from before a schedule was reprogrammed', () => {
    const habit = {
      createdAt: '2026-08-31T08:00:00-06:00',
      isActive: true,
      schedule: {
        kind: 'times_per_week', timezone: 'America/Mexico_City', effectiveFrom: '2026-09-02',
        periodMinimum: 2, periodTarget: 3, periodExtra: 4,
      },
      logs: {
        1: { localDate: '2026-08-31', level: 3 },
        2: { localDate: '2026-09-01', level: 3 },
      },
    }

    expect(scheduleProgressForDate(habit, new Date('2026-09-03T18:00:00Z'))).toMatchObject({
      built: 0,
      countFrom: '2026-09-02',
      remaining: 2,
    })
    expect(isHabitScheduledForDate(habit, new Date('2026-09-03T18:00:00Z'))).toBe(true)
  })

  it('recalculates the local weekday when the schedule timezone changes', () => {
    const habit = {
      createdAt: '2026-08-30T12:00:00.000Z',
      isActive: true,
      schedule: { kind: 'weekdays', timezone: 'America/Mexico_City', effectiveFrom: '2026-08-30', daysOfWeek: [1] },
    }
    const instant = new Date('2026-08-31T01:00:00.000Z')

    expect(isHabitScheduledForDate(habit, instant)).toBe(false)
    habit.schedule.timezone = 'Asia/Tokyo'
    expect(isHabitScheduledForDate(habit, instant)).toBe(true)
  })

  it('keeps every-n-days cadence stable across a daylight-saving transition', () => {
    const habit = {
      createdAt: '2026-03-07T12:00:00-05:00',
      isActive: true,
      schedule: {
        kind: 'every_n_days',
        timezone: 'America/New_York',
        effectiveFrom: '2026-03-07',
        intervalDays: 1,
      },
    }

    expect(isHabitScheduledForDate(habit, new Date('2026-03-08T16:00:00.000Z'))).toBe(true)
    expect(isHabitScheduledForDate(habit, new Date('2026-03-09T16:00:00.000Z'))).toBe(true)
  })

  it('keeps local dates and sequential day numbers reversible', () => {
    expect(localDateForDay('2026-08-27T10:00:00-06:00', 3, 'America/Mexico_City')).toBe('2026-08-29')
    expect(dayNumberForLocalDate('2026-08-27T10:00:00-06:00', '2026-08-29', 'America/Mexico_City')).toBe(3)
  })

  it('maps legacy effort levels to the canonical log states', () => {
    expect(logStatusForLevel(3)).toBe('done')
    expect(logStatusForLevel(1)).toBe('partial')
    expect(logLevelForStatus('partial', true)).toBe(1)
    expect(logLevelForStatus('conscious_skip')).toBe(4)
  })

  it('keeps the three decisions and their secondary contexts reversible', () => {
    expect(normalizeHabitLogOutcome({ status: 'done' })).toEqual({ status: 'done', minimumUsed: false, contextCodes: [], level: 3 })
    expect(normalizeHabitLogOutcome({ status: 'partial' })).toEqual({ status: 'partial', minimumUsed: false, contextCodes: [], level: 2 })
    expect(normalizeHabitLogOutcome({ status: 'partial', minimumUsed: true })).toEqual({ status: 'partial', minimumUsed: true, contextCodes: [], level: 1 })
    expect(normalizeHabitLogOutcome({ status: 'not_done' })).toEqual({ status: 'not_done', minimumUsed: false, contextCodes: [], level: 0 })
    expect(normalizeHabitLogOutcome({ status: 'conscious_skip' })).toEqual({ status: 'conscious_skip', minimumUsed: false, contextCodes: [], level: 4 })
  })

  it('adds stable cloud metadata to a local log', () => {
    const first = normalizeHabitLog({ level: 2 }, {
      habit: { createdAt: '2026-08-27T10:00:00-06:00', schedule: { timezone: 'America/Mexico_City' } },
      day: 2,
    })
    const second = normalizeHabitLog(first, {
      habit: { createdAt: '2026-08-27T10:00:00-06:00', schedule: { timezone: 'America/Mexico_City' } },
      day: 2,
    })
    expect(first.localDate).toBe('2026-08-28')
    expect(first).toMatchObject({ status: 'partial', minimumUsed: false, level: 2, contextCodes: [] })
    expect(second.id).toBe(first.id)
    expect(second.clientOperationId).toBe(first.clientOperationId)
  })
})

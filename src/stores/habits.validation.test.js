import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_HABIT_DURATION, normalizeHabitDuration, restoreCollapsedHabitColors, useHabitsStore } from './habits'
import { DEFAULT_HABIT_COLOR, habitColorForeground, normalizeHabitColor, PALETTE } from '@utils/colors'
import { push } from '@services/supabase/sync.service'

vi.mock('@services/supabase/sync.service', () => ({ push: vi.fn(() => Promise.resolve()) }))

describe('habit data boundaries', () => {
  it('clamps durations before they reach the day grid', () => {
    expect(normalizeHabitDuration(-12)).toBe(1)
    expect(normalizeHabitDuration('90')).toBe(90)
    expect(normalizeHabitDuration(50_000)).toBe(MAX_HABIT_DURATION)
    expect(normalizeHabitDuration('invalid')).toBe(30)
  })

  it('preserves valid custom colors and rejects malformed values', () => {
    expect(normalizeHabitColor(PALETTE[0].value.toLowerCase())).toBe(PALETTE[0].value)
    expect(normalizeHabitColor('#637f50')).toBe('#637F50')
    expect(normalizeHabitColor('not-a-color')).toBe(DEFAULT_HABIT_COLOR)
  })

  it('selects a readable foreground for custom colors', () => {
    expect(habitColorForeground('#FFFFFF')).toBe('#0A0E1A')
    expect(habitColorForeground('#000000')).toBe('#FCFCFF')
  })

  it('repairs a collection whose colors were collapsed to the fallback', () => {
    const collapsed = [
      { id: 'one', color: DEFAULT_HABIT_COLOR },
      { id: 'two', color: DEFAULT_HABIT_COLOR },
      { id: 'three', color: DEFAULT_HABIT_COLOR },
    ]
    expect(new Set(restoreCollapsedHabitColors(collapsed).map(habit => habit.color)).size).toBe(3)
  })

  it('does not alter an intentional mixed-color collection', () => {
    const mixed = [
      { id: 'one', color: DEFAULT_HABIT_COLOR },
      { id: 'two', color: '#637F50' },
    ]
    expect(restoreCollapsedHabitColors(mixed)).toBe(mixed)
  })

  it('keeps multiple goal links, a calendar and canonical log metadata', () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    const habit = store.addHabit({
      name: 'Caminar',
      minimumVersion: 'Salir cinco minutos',
      goalIds: ['goal-one', 'goal-two'],
      icon: 'Footprints',
      color: PALETTE[0].value,
      duration: 30,
      reminder: null,
      reminderDays: null,
      schedule: { daysOfWeek: [1, 3, 5], timezone: 'America/Mexico_City' },
    })

    expect(habit.goalIds).toEqual(['goal-one', 'goal-two'])
    expect(habit.schedule.daysOfWeek).toEqual([1, 3, 5])
    store.logDay(habit.id, 1, { level: 1, emotion: 'calm', energy: 'low', note: '' })
    expect(habit.logs[1]).toMatchObject({ level: 1, status: 'partial', minimumUsed: true, localDate: expect.any(String), occurrenceKey: expect.any(String) })
    expect(habit.logs[1].id).toBeTruthy()
    expect(habit.logs[1].clientOperationId).toBeTruthy()
  })

  it('persists canonical decisions while retaining the legacy level projection', () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    const habit = store.addHabit({ name: 'Leer', duration: 10 })

    store.logDay(habit.id, 1, { status: 'partial', minimumUsed: true, contextCodes: ['Trabajo', 'trabajo'] })
    expect(habit.logs[1]).toMatchObject({ status: 'partial', minimumUsed: true, contextCodes: ['trabajo'], level: 1 })

    store.logDay(habit.id, 1, { status: 'conscious_skip', minimumUsed: true })
    expect(habit.logs[1]).toMatchObject({ status: 'conscious_skip', minimumUsed: false, level: 4 })

    store.logDay(habit.id, 1, { level: 3 })
    expect(habit.logs[1]).toMatchObject({ status: 'done', minimumUsed: false, level: 3 })
  })

  it('reprograms a habit without deleting its history or weekly targets', () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    const habit = store.addHabit({
      name: 'Practicar inglés',
      minimumVersion: 'Cinco minutos',
      duration: 30,
      schedule: {
        kind: 'weekdays',
        daysOfWeek: [1, 3, 5],
        timezone: 'America/Mexico_City',
      },
    })
    store.logDay(habit.id, 1, { level: 3, note: 'Primer registro' })
    const logId = habit.logs[1].id

    store.updateHabit(habit.id, {
      schedule: {
        ...habit.schedule,
        kind: 'times_per_week',
        periodMinimum: 3,
        periodTarget: 4,
        periodExtra: 5,
      },
    })

    expect(habit.schedule).toMatchObject({
      kind: 'times_per_week',
      daysOfWeek: null,
      periodMinimum: 3,
      periodTarget: 4,
      periodExtra: 5,
      version: 2,
    })
    expect(habit.logs[1]).toMatchObject({ id: logId, note: 'Primer registro' })
    expect(push).toHaveBeenLastCalledWith('upsert-habit', { habit })
  })

  it('prefers the canonical cloud value only after an explicit conflict decision', () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    const local = store.addHabit({ name: 'Versión local', duration: 10 })
    local.version = 2
    local.updatedAt = '2026-09-01T06:10:00.000Z'
    const cloud = {
      ...JSON.parse(JSON.stringify(local)),
      name: 'Versión de Supabase',
      updatedAt: '2026-09-01T06:09:00.000Z',
    }

    store.mergeFromCloud([cloud])
    expect(local.name).toBe('Versión local')

    store.mergeFromCloud([cloud], { preferCloud: true })
    expect(local.name).toBe('Versión de Supabase')
  })

  it('lets a higher canonical version win even when the device clock is far ahead', () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    const local = store.addHabit({ name: 'Reloj local adelantado', duration: 10 })
    local.version = 2
    local.updatedAt = '2036-09-01T06:10:00.000Z'
    store.logDay(local.id, 1, { level: 1, note: 'Registro local' })
    local.logs[1].version = 2
    local.logs[1].loggedAt = '2036-09-01T06:10:00.000Z'

    store.mergeFromCloud([{
      ...JSON.parse(JSON.stringify(local)),
      name: 'Versión canónica',
      version: 3,
      updatedAt: '2026-09-01T06:09:00.000Z',
      logs: {
        1: {
          ...JSON.parse(JSON.stringify(local.logs[1])),
          note: 'Registro canónico',
          version: 3,
          loggedAt: '2026-09-01T06:09:00.000Z',
        },
      },
    }])

    expect(local).toMatchObject({ name: 'Versión canónica', version: 3 })
    expect(local.logs[1]).toMatchObject({ note: 'Registro canónico', version: 3 })
  })

  it('applies content-free v2 tombstones after the cloud snapshot', () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    const removedHabit = store.addHabit({ name: 'Eliminar', duration: 10 })
    const keptHabit = store.addHabit({ name: 'Conservar', duration: 10 })
    store.logDay(keptHabit.id, 1, { level: 3, note: '' })
    const removedLogId = keptHabit.logs[1].id

    store.applyV2Changes([
      { entityType: 'habit', entityId: removedHabit.id, operationType: 'delete', result: 'applied' },
      { entityType: 'habitLog', entityId: removedLogId, operationType: 'delete', result: 'applied' },
      { entityType: 'habit', entityId: keptHabit.id, operationType: 'delete', result: 'conflict' },
    ])

    expect(store.habits.map(item => item.id)).toEqual([keptHabit.id])
    expect(keptHabit.logs[1]).toBeUndefined()
  })

  it('does not materialize a pilot restore rejected by v2', async () => {
    setActivePinia(createPinia())
    const store = useHabitsStore()
    vi.mocked(push).mockResolvedValueOnce({
      status: 'conflict',
      conflict: { code: 'version_mismatch', remoteVersion: 5 },
    })

    const result = await store.restoreHabitFromPilot({
      id: 'habit-deleted',
      name: 'No debe volver',
      version: 3,
      deletedAt: '2026-08-29T18:00:00.000Z',
    })

    expect(result.status).toBe('conflict')
    expect(store.habits).toEqual([])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/config/features.js', () => ({ features: { goals: false } }))
vi.mock('@services/notifications.service', () => ({ sendTestNotification: vi.fn() }))
vi.mock('@services/supabase/sync.service', () => ({ push: vi.fn(() => Promise.resolve()) }))

import CreateHabitModal from './CreateHabitModal.vue'
import { localDateKey } from '@/features/habits/domain.js'
import { useHabitsStore } from '@stores/habits'

const weeklyHabit = () => ({
  id: 'habit-weekly',
  name: 'Practicar inglés',
  minimumVersion: 'Cinco minutos',
  icon: 'BookOpen',
  color: '#637F50',
  duration: 30,
  isActive: true,
  lifecycleStatus: 'active',
  version: 1,
  reminder: null,
  reminderDays: null,
  createdAt: '2026-08-25T14:00:00.000Z',
  updatedAt: '2026-08-25T14:00:00.000Z',
  schedule: {
    id: 'schedule-weekly',
    kind: 'times_per_week',
    timezone: 'America/Mexico_City',
    daysOfWeek: null,
    periodMinimum: 3,
    periodTarget: 4,
    periodExtra: 5,
    effectiveFrom: '2026-08-25',
    effectiveTo: null,
    isActive: true,
    version: 1,
  },
  logs: {},
})

async function reachScheduleStep(wrapper) {
  const continueButton = () => wrapper.get('button.wz-cta')
  await continueButton().trigger('click')
  await continueButton().trigger('click')
  await continueButton().trigger('click')
}

describe('CreateHabitModal flexible schedules', () => {
  let pinia
  let store

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    store = useHabitsStore()
  })

  it('reveals only the fields required by the selected frequency', async () => {
    const habit = weeklyHabit()
    store.habits = [habit]
    const wrapper = mount(CreateHabitModal, {
      props: { habit },
      global: { plugins: [pinia], stubs: { Teleport: true } },
    })
    await reachScheduleStep(wrapper)

    const kind = wrapper.get('#habit-schedule-kind')
    expect(kind.element.value).toBe('times_per_week')
    expect(wrapper.findAll('.wz-target-grid input')).toHaveLength(3)
    expect(wrapper.text()).toContain('Mínimo 3 · objetivo 4 por semana')

    await kind.setValue('every_n_days')
    expect(wrapper.find('.wz-target-grid').exists()).toBe(false)
    expect(wrapper.find('.wz-number-field--wide input').exists()).toBe(true)

    await kind.setValue('window')
    expect(wrapper.findAll('.wz-window-grid input')).toHaveLength(2)
    expect(wrapper.find('.wz-days').exists()).toBe(false)
  })

  it('reprograms from today and preserves existing habit data', async () => {
    const habit = weeklyHabit()
    habit.logs = { 1: { id: 'log-1', localDate: '2026-08-25', level: 3, note: 'Guardado' } }
    store.habits = [habit]
    const wrapper = mount(CreateHabitModal, {
      props: { habit },
      global: { plugins: [pinia], stubs: { Teleport: true } },
    })
    await reachScheduleStep(wrapper)

    await wrapper.get('#habit-schedule-kind').setValue('every_n_days')
    await wrapper.get('.wz-number-field--wide input').setValue(3)
    await wrapper.get('button.wz-cta').trigger('click')

    expect(habit.schedule).toMatchObject({
      kind: 'every_n_days',
      intervalDays: 3,
      effectiveFrom: localDateKey(),
      version: 2,
    })
    expect(habit.logs[1]).toMatchObject({ id: 'log-1', note: 'Guardado' })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

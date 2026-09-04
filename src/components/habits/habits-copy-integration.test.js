/**
 * Lightweight integration coverage confirming HabitRow / LogModal /
 * DayCloseModal render text resolved via the copy catalog (src/features/copy)
 * instead of the old fixed strings (PICK_LEVELS.confirm / RESCUE_MESSAGES /
 * the hardcoded "Día cerrado: ..." sentence).
 *
 * Math.random is mocked to 0 so `pickPhrase` always resolves to the first
 * candidate in its pool — makes the picked text deterministic and lets us
 * assert against the actual catalog content.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { GENERIC_EVENTS } from '@/features/copy/catalog.js'
import { interpolate } from '@/features/copy/engine.js'
import { useHabitsStore } from '@stores/habits'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import HabitRow from './HabitRow.vue'
import LogModal from './LogModal.vue'
import DayCloseModal from './DayCloseModal.vue'

function makeHabit(overrides = {}) {
  return {
    id: 'h1',
    name: 'Correr',
    minimumVersion: 'Salir 5 minutos',
    icon: 'Activity',
    color: '#6C8CFF',
    duration: 30,
    isActive: true,
    reminder: null,
    reminderDays: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    copySettings: null,
    logs: {},
    ...overrides,
  }
}

describe('integración copy — componentes de hábitos', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('HabitRow muestra el mensaje de confirmación resuelto por el catálogo, no un string fijo', async () => {
    const habit = makeHabit()
    const wrapper = mount(HabitRow, { props: { habit } })

    await wrapper.find('.hr__quick').trigger('click')
    expect(wrapper.findAll('.hr__pick').map(button => button.text())).toEqual(['Sí', 'A medias', 'No'])
    const completeButton = wrapper.find('.hr__pick--lv3')
    await completeButton.trigger('click')

    const expected = interpolate(GENERIC_EVENTS.habit_completed.no_respect[0].text, 'habit_completed', { habitName: habit.name })
    expect(wrapper.find('.hr__confirm').text()).toBe(expected)
    // Not the old fixed confirm strings this replaced.
    expect(wrapper.find('.hr__confirm').text()).not.toBe('¡Día completo!')
  })

  it('LogModal muestra el mensaje de rescate sólo dentro del contexto de versión mínima', async () => {
    const habit = makeHabit({ minimumVersion: '' })
    // AuroraBottomSheet teleports to <body> — attach so the teleported
    // content is queryable via the live DOM.
    const wrapper = mount(LogModal, { props: { habit, day: 1 }, attachTo: document.body })
    const partial = [...document.body.querySelectorAll('.lm-decisions button')].find(button => button.textContent.includes('A medias'))
    partial?.click()
    await wrapper.vm.$nextTick()

    const expected = interpolate(GENERIC_EVENTS.task_started.no_respect[0].text, 'task_started', { habitName: habit.name })
    const rescueEl = document.body.querySelector('.lm-secondary small')
    expect(rescueEl?.textContent).toBe(expected)
    expect(rescueEl?.textContent).not.toBe('Haz solo 5 minutos. Eso mantiene el hábito vivo.')
  })

  it('LogModal presenta tres decisiones, guarda la principal en dos toques y oculta el contexto opcional', async () => {
    const habit = makeHabit()
    const store = useHabitsStore()
    store.habits = [habit]
    const wrapper = mount(LogModal, { props: { habit, day: 1 }, attachTo: document.body })
    const decisions = [...document.body.querySelectorAll('.lm-decisions button')]

    expect(decisions.map(button => button.querySelector('strong')?.textContent)).toEqual(['Sí', 'A medias', 'No'])
    expect(document.body.querySelector('#log-context')).toBeNull()

    decisions[0].click()
    await wrapper.vm.$nextTick()
    const save = [...document.body.querySelectorAll('button')].find(button => button.textContent.includes('Guardar registro'))
    save?.click()
    await wrapper.vm.$nextTick()

    expect(habit.logs[1]).toMatchObject({ status: 'done', minimumUsed: false, level: 3 })
    expect(wrapper.emitted('saved')[0][0]).toMatchObject({ status: 'done', minimumUsed: false, level: 3 })
  })

  it('LogModal ofrece mínimo y descanso como contexto, no como decisiones principales', async () => {
    const habit = makeHabit()
    const wrapper = mount(LogModal, { props: { habit, day: 1 }, attachTo: document.body })
    const decisions = [...document.body.querySelectorAll('.lm-decisions button')]

    decisions[1].click()
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.lm-secondary')?.textContent).toContain('Usé mi versión mínima')

    decisions[2].click()
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.lm-secondary')?.textContent).toContain('Fue un descanso consciente')
  })

  it('LogModal permite guardar un No sin exigir explicación', async () => {
    const habit = makeHabit()
    const store = useHabitsStore()
    store.habits = [habit]
    const wrapper = mount(LogModal, { props: { habit, day: 1 }, attachTo: document.body })
    const no = [...document.body.querySelectorAll('.lm-decisions button')].find(button => button.querySelector('strong')?.textContent === 'No')

    no?.click()
    await wrapper.vm.$nextTick()
    const save = [...document.body.querySelectorAll('button')].find(button => button.textContent.includes('Guardar registro'))
    save?.click()
    await wrapper.vm.$nextTick()

    expect(habit.logs[1]).toMatchObject({ status: 'not_done', minimumUsed: false, level: 0, note: '' })
    expect(habit.logs[1].emotion).toBeNull()
    expect(habit.logs[1].energy).toBeNull()
  })

  it('DayCloseModal cierra un día suficiente sin convertir lo demás en deuda', () => {
    mount(DayCloseModal, {
      props: {
        summary: { state: 'sufficient', isSufficient: true, built: 1, adapted: 1, complete: 0 },
      },
      attachTo: document.body,
    })

    const message = document.body.querySelector('.day-close__message')
    expect(message?.textContent).toContain('Hoy fue suficiente.')
    expect(message?.textContent).toContain('Lo demás no se convierte en deuda.')
  })

  it('DayCloseModal ofrece actualizar explícitamente un cierre con registros nuevos', async () => {
    const wrapper = mount(DayCloseModal, {
      props: {
        summary: { state: 'moved', isSufficient: false, built: 1, adapted: 1, complete: 0 },
        closure: { status: 'quiet', tomorrowNote: '' },
        canUpdate: true,
      },
      attachTo: document.body,
    })

    const button = [...document.body.querySelectorAll('button')].find(item => item.textContent.includes('Actualizar cierre'))
    button?.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})

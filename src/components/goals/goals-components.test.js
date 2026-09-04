import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EffortSelector from './EffortSelector.vue'
import GoalNextStepCard from './GoalNextStepCard.vue'
import GoalReturnCard from './GoalReturnCard.vue'
import GoalProgressTimeline from './GoalProgressTimeline.vue'
import DashboardGoalFocus from './DashboardGoalFocus.vue'
import GoalsPrivacyPanel from './GoalsPrivacyPanel.vue'
import MinimalVersionSelector from './MinimalVersionSelector.vue'
import GoalMinimumCompletionFeedback from './GoalMinimumCompletionFeedback.vue'
import GoalActionForm from './GoalActionForm.vue'
import GoalMilestonesPanel from './GoalMilestonesPanel.vue'

describe('goal components', () => {
  it('exposes one clear primary action and an adaptation action', async () => {
    const wrapper = mount(GoalNextStepCard, { props: { title: 'Abrir el documento' } })
    const buttons = wrapper.findAll('button')

    expect(buttons).toHaveLength(2)
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('primary')).toHaveLength(1)
    expect(wrapper.emitted('secondary')).toHaveLength(1)
  })

  it('disables return action while work is being prepared', () => {
    const wrapper = mount(GoalReturnCard, { props: { busy: true } })
    const button = wrapper.get('button')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe('Preparando…')
  })

  it('announces effort choices as a radio group', async () => {
    const wrapper = mount(EffortSelector, { props: { modelValue: 'medium' } })
    const radios = wrapper.findAll('[role="radio"]')

    expect(radios).toHaveLength(3)
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-labelledby')).toBe(wrapper.get('legend').attributes('id'))
    expect(radios[1].attributes('aria-checked')).toBe('true')
    await radios[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['low'])
    expect(radios[1].attributes('tabindex')).toBe('0')
    expect(radios[0].attributes('tabindex')).toBe('-1')
    await radios[1].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')[1]).toEqual(['high'])
  })

  it('keeps the postpone option neutral and selectable', async () => {
    const options = [
      { value: 'minimum', label: 'Mínima', detail: 'Abrir el documento' },
      { value: 'usual', label: 'Habitual', detail: 'Escribir 15 min' },
      { value: 'later', label: 'Hoy no', detail: 'Lo dejamos para después' },
    ]
    const wrapper = mount(MinimalVersionSelector, { props: { options, modelValue: 'usual' } })
    const radios = wrapper.findAll('[role="radio"]')

    expect(radios).toHaveLength(3)
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-labelledby')).toBe(wrapper.get('legend').attributes('id'))
    await radios[2].trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['later'])
    await radios[1].trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')[1]).toEqual(['minimum'])
  })

  it('asks for the concrete action before revealing optional planning details', async () => {
    const wrapper = mount(GoalActionForm)

    expect(wrapper.find('.action-form__details').exists()).toBe(false)
    expect(wrapper.get('.action-form__details-toggle').attributes('aria-expanded')).toBe('false')
    await wrapper.get('input[autofocus]').setValue('Abrir el documento')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')[0][0]).toMatchObject({
      title: 'Abrir el documento',
      minimumVersion: '',
      energyLevel: 'medium',
      estimateBucket: '15m',
    })

    await wrapper.get('.action-form__details-toggle').trigger('click')
    expect(wrapper.get('.action-form__details').exists()).toBe(true)
    expect(wrapper.get('.action-form__details-toggle').attributes('aria-expanded')).toBe('true')
  })

  it('summarises persisted movement without streak language', () => {
    const wrapper = mount(GoalProgressTimeline, {
      props: {
        actions: [{ id: 'action-1', title: 'Escribir tres ideas', status: 'completed' }],
        sessions: [{ id: 'session-1', status: 'finished', actualSeconds: 900 }],
        entries: [{
          id: 'progress-1', actionId: 'action-1', sessionId: 'session-1', kind: 'action_completed',
          note: 'Quedó listo el borrador', occurredAt: '2026-08-25T12:00:00.000Z',
        }],
      },
    })

    expect(wrapper.text()).toContain('15 min')
    expect(wrapper.text()).toContain('Acción completada')
    expect(wrapper.text()).toContain('Quedó listo el borrador')
    expect(wrapper.text()).toContain('sin rachas')
  })

  it('requires evidence before emitting milestone completion', async () => {
    const wrapper = mount(GoalMilestonesPanel, {
      props: { milestones: [{ id: 'm1', title: 'Publicar borrador', status: 'active', position: 0 }] },
    })

    await wrapper.get('.milestones__actions button').trigger('click')
    expect(wrapper.get('.milestones__evidence button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('.milestones__evidence textarea').setValue('Enlace público verificado')
    await wrapper.get('.milestones__evidence').trigger('submit')

    expect(wrapper.emitted('status')[0][0]).toEqual({ id: 'm1', status: 'completed', evidenceSummary: 'Enlace público verificado' })
  })

  it('reveals a long trajectory in small batches', async () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({
      id: `progress-${index}`,
      kind: 'started',
      occurredAt: new Date(Date.UTC(2026, 7, 25, 12, index)).toISOString(),
    }))
    const wrapper = mount(GoalProgressTimeline, { props: { entries } })

    expect(wrapper.findAll('.goal-progress__timeline li')).toHaveLength(12)
    await wrapper.get('.goal-progress__more').trigger('click')
    expect(wrapper.findAll('.goal-progress__timeline li')).toHaveLength(24)
    await wrapper.get('.goal-progress__more').trigger('click')
    expect(wrapper.findAll('.goal-progress__timeline li')).toHaveLength(25)
    expect(wrapper.find('.goal-progress__more').exists()).toBe(false)
  })

  it('routes an active dashboard action directly into its session', () => {
    const wrapper = mount(DashboardGoalFocus, {
      props: {
        goal: { id: 'goal-1', title: 'Entregar propuesta' },
        action: { id: 'action-1', title: 'Abrir el documento', status: 'ready', minimumVersion: '' },
      },
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })

    expect(wrapper.text()).toContain('Abrir el documento')
    expect(wrapper.text()).toContain('Empezar ahora')
    expect(wrapper.find('.today-goal__action').attributes('href')).toBe('/goals/goal-1/session')
  })

  it('keeps cloud sync and product analytics as separate consent controls', async () => {
    const wrapper = mount(GoalsPrivacyPanel, {
      props: { syncEnabled: true, analyticsEnabled: false, authenticated: true, online: true },
    })
    const switches = wrapper.findAll('[role="switch"]')

    expect(switches).toHaveLength(2)
    expect(switches[0].attributes('aria-checked')).toBe('true')
    expect(switches[1].attributes('aria-checked')).toBe('false')
    expect(wrapper.text()).toContain('Nunca títulos, motivos, notas, bloqueos ni evidencias')
    await switches[1].trigger('click')
    expect(wrapper.emitted('toggle-analytics')).toHaveLength(1)
  })

  it('reassures people that local data stays safe during a sync conflict', () => {
    const wrapper = mount(GoalsPrivacyPanel, {
      props: { syncEnabled: true, authenticated: true, syncStatus: 'conflict', conflictCount: 2 },
    })

    expect(wrapper.text()).toContain('2 cambios necesitan revisión')
    expect(wrapper.text()).toContain('La versión local sigue segura')
    expect(wrapper.get('.privacy-panel__status button').text()).toBe('Reintentar con seguridad')
  })

  it('connects a completed minimum version with the point of return', async () => {
    const wrapper = mount(GoalMinimumCompletionFeedback, {
      props: {
        goalTitle: 'Preparar propuesta',
        minimumVersion: 'Abrir el documento y escribir una línea',
        returnTitle: 'Ordenar las ideas principales',
        minutes: 4,
      },
    })

    expect(wrapper.text()).toContain('El recorrido continúa')
    expect(wrapper.text()).toContain('Abrir el documento y escribir una línea')
    expect(wrapper.text()).toContain('Ordenar las ideas principales')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('se conecta')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('continue')).toHaveLength(1)
  })
})

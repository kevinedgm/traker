import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Gift, History, House, ListChecks } from 'lucide-vue-next'
import * as Aurora from './index.js'
import AuroraHabitCard from './habits/AuroraHabitCard.vue'
import AuroraBottomNav from './navigation/AuroraBottomNav.vue'
import AuroraBottomSheet from './surfaces/AuroraBottomSheet.vue'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Aurora component catalog', () => {
  it('exports the complete migrated catalog', () => {
    expect(Object.keys(Aurora)).toHaveLength(39)
    for (const component of Object.values(Aurora)) expect(component).toBeTruthy()
  })

  it('morphs a habit row into its adapted state without changing its structure', async () => {
    const wrapper = mount(AuroraHabitCard, {
      props: { name: 'Leer', detail: 'Versión mínima: una página', state: 'pending' },
    })

    expect(wrapper.classes()).toContain('habit--pending')
    await wrapper.setProps({ state: 'adapted', detail: 'Versión mínima registrada' })
    expect(wrapper.classes()).toContain('habit--adapted')
    expect(wrapper.findAll('.habit')).toHaveLength(1)
  })

  it('shows compact labels and exposes the canonical name to assistive technology', async () => {
    const items = [
      { value: 'home', label: 'Hoy', icon: House },
      { value: 'habits', label: 'Hábitos', icon: ListChecks },
      { value: 'rewards', label: 'Recompensas', shortLabel: 'Premios', icon: Gift },
      { value: 'history', label: 'Historial', icon: History },
    ]
    const wrapper = mount(AuroraBottomNav, { props: { modelValue: 'rewards', items } })
    const buttons = wrapper.findAll('button')

    expect(buttons.map(button => button.text())).toEqual(['Hoy', 'Hábitos', 'Premios', 'Historial'])
    expect(buttons[2].attributes('aria-label')).toBe('Recompensas')
    expect(buttons[2].attributes('aria-current')).toBe('page')
    expect(buttons[0].attributes('aria-current')).toBeUndefined()

    await buttons[3].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['history']])
  })

  it('applies the sheet variant to the teleported overlay without leaking attributes', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(AuroraBottomSheet, {
      attachTo: document.body,
      props: { open: true, title: 'Registro' },
    })

    expect(document.body.querySelector('.a-overlay.a-sheet')).toBeTruthy()
    expect(warning.mock.calls.flat().join(' ')).not.toContain('Extraneous non-props attributes')
    wrapper.unmount()
  })
})

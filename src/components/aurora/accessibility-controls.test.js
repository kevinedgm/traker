import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AuroraInput from './forms/AuroraInput.vue'
import AuroraMenu from './navigation/AuroraMenu.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import HelpMascotButton from '@/components/help/HelpMascotButton.vue'

afterEach(() => { document.body.innerHTML = '' })

describe('accessible controls', () => {
  it('links Aurora input errors and hints to the control', () => {
    const wrapper = mount(AuroraInput, { props: { label: 'Nombre', error: 'Escribe un nombre.' } })
    const input = wrapper.get('input')
    const message = wrapper.get('[role="alert"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(message.attributes('id'))
    expect(input.attributes('aria-errormessage')).toBe(message.attributes('id'))
  })

  it('links BaseInput helper text while preserving an external description', () => {
    const wrapper = mount(BaseInput, {
      props: { label: 'Correo', hint: 'Sólo se usa para iniciar sesión.' },
      attrs: { 'aria-describedby': 'privacy-note' },
    })
    const describedBy = wrapper.get('input').attributes('aria-describedby').split(' ')
    expect(describedBy).toContain('privacy-note')
    expect(describedBy).toContain(wrapper.get('span[id]').attributes('id'))
  })

  it('moves through menu items with arrows and restores the trigger on Escape', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(AuroraMenu, {
      attachTo: document.body,
      props: { open: false, items: [{ value: 'edit', label: 'Editar' }, { value: 'delete', label: 'Eliminar' }] },
    })
    await wrapper.setProps({ open: true })
    await nextTick()
    const items = wrapper.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(items[0].element)

    await items[0].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1].element)
    await items[1].trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(items[0].element)
    await items[0].trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('keeps the help popover in native tab order and returns focus on Escape', async () => {
    const wrapper = mount(HelpMascotButton, { attachTo: document.body })
    const trigger = wrapper.get('[aria-label="Ayuda"]')
    trigger.element.focus()
    await trigger.trigger('click')
    expect(wrapper.get('[role="region"]').attributes('id')).toBe(trigger.attributes('aria-controls'))
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})

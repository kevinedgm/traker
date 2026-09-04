import { computed, defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useModalFocus } from './useModalFocus'

const TestDialog = defineComponent({
  emits: ['close'],
  setup(_, { emit }) {
    const dialog = ref(null)
    useModalFocus(dialog, { initialFocus: '[data-first]', onClose: () => emit('close') })
    return { dialog }
  },
  template: `
    <div ref="dialog" role="dialog" tabindex="-1">
      <button data-first>Primero</button>
      <button data-last>Último</button>
    </div>
  `,
})

const DialogWithInertSection = defineComponent({
  setup() {
    const dialog = ref(null)
    useModalFocus(dialog, { initialFocus: '[data-confirm-first]' })
    return { dialog }
  },
  template: `
    <div ref="dialog" role="dialog" tabindex="-1">
      <div inert><button data-inert-action>Acción inactiva</button></div>
      <div role="alertdialog">
        <button data-confirm-first>Seguir editando</button>
        <button data-confirm-last>Salir</button>
      </div>
    </div>
  `,
})

const InitiallyClosedDialog = defineComponent({
  props: { open: Boolean },
  emits: ['close'],
  setup(props, { emit }) {
    const dialog = ref(null)
    useModalFocus(dialog, {
      enabled: computed(() => props.open),
      initialFocus: '[data-dynamic-first]',
      onClose: () => emit('close'),
    })
    return { dialog }
  },
  template: '<div v-if="open" ref="dialog" role="dialog" tabindex="-1"><button data-dynamic-first>Primero</button></div>',
})

describe('useModalFocus', () => {
  let trigger
  let appRoot

  beforeEach(() => {
    document.querySelector('#app')?.remove()
    appRoot = document.createElement('div')
    appRoot.id = 'app'
    trigger = document.createElement('button')
    trigger.textContent = 'Abrir'
    appRoot.append(trigger)
    document.body.append(appRoot)
    trigger.focus()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('mueve el foco, bloquea el fondo y lo restaura al cerrar', async () => {
    const wrapper = mount(TestDialog, { attachTo: document.body })
    await nextTick()

    expect(document.activeElement).toBe(wrapper.find('[data-first]').element)
    expect(appRoot.inert).toBe(true)
    expect(appRoot.getAttribute('aria-hidden')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
    expect(appRoot.inert).toBe(false)
    expect(appRoot.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('cierra con Escape y contiene Tab en ambos sentidos', async () => {
    const wrapper = mount(TestDialog, { attachTo: document.body })
    await nextTick()
    const first = wrapper.find('[data-first]').element
    const last = wrapper.find('[data-last]').element

    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(last)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('excluye controles dentro de ancestros inert al contener el foco', async () => {
    const wrapper = mount(DialogWithInertSection, { attachTo: document.body })
    await nextTick()
    const first = wrapper.find('[data-confirm-first]').element
    const last = wrapper.find('[data-confirm-last]').element

    expect(document.activeElement).toBe(first)
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(first)
    expect(document.activeElement).not.toBe(wrapper.find('[data-inert-action]').element)
    wrapper.unmount()
  })

  it('activa Escape y restaura el foco cuando un diálogo inicialmente cerrado se abre', async () => {
    const wrapper = mount(InitiallyClosedDialog, { attachTo: document.body, props: { open: false } })
    expect(document.body.style.overflow).toBe('')

    await wrapper.setProps({ open: true })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-dynamic-first]').element)
    expect(document.body.style.overflow).toBe('hidden')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })
})

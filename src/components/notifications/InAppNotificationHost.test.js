import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InAppNotificationHost from './InAppNotificationHost.vue'

describe('InAppNotificationHost feedback', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('guarda me sirvió localmente sin persistir el texto mostrado', async () => {
    const wrapper = mount(InAppNotificationHost, { attachTo: document.body })
    window.dispatchEvent(new CustomEvent('traker:notification', {
      detail: {
        title: 'Cierra el día sin deuda',
        body: 'Guarda lo que sí pasó.',
        phraseId: 'notification.evening_close.01',
      },
    }))
    await wrapper.vm.$nextTick()

    const helpful = [...document.body.querySelectorAll('.notification-banner__feedback button')]
      .find(button => button.textContent.includes('Me sirvió'))
    await helpful.click()
    await wrapper.vm.$nextTick()

    const state = JSON.parse(localStorage.getItem('traker:copy-state'))
    expect(state.feedback.at(-1)).toMatchObject({
      phraseId: 'notification.evening_close.01',
      verdict: 'helpful',
    })
    expect(JSON.stringify(state)).not.toContain('Guarda lo que sí pasó')
    expect(document.body.textContent).toContain('Respuesta guardada sólo en este dispositivo.')
    wrapper.unmount()
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia } from 'pinia'
import componentSource from './LockOverlay.vue?raw'
import LockOverlay from './LockOverlay.vue'

describe('LockOverlay', () => {
  let wrapper
  let appRoot

  beforeEach(() => {
    document.querySelector('#app')?.remove()
    appRoot = document.createElement('div')
    appRoot.id = 'app'
    document.body.append(appRoot)
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'scroll'
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    appRoot?.remove()
    appRoot = null
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  })

  it('keeps the modal fixed independently from the relative Aurora layer', () => {
    wrapper = mount(LockOverlay, {
      attachTo: document.body,
      global: { plugins: [createPinia()] },
    })

    const overlay = wrapper.get('[role="dialog"]')
    expect(overlay.classes()).toContain('lock-overlay')
    expect(overlay.attributes('aria-modal')).toBe('true')
    expect(overlay.get('.lock-aurora').classes()).toContain('aurora-ambient')
    expect(componentSource).toMatch(/\.lock-overlay\s*\{[\s\S]*?position:\s*fixed;/)
  })

  it('locks background scrolling and restores the previous styles on close', () => {
    wrapper = mount(LockOverlay, {
      attachTo: document.body,
      global: { plugins: [createPinia()] },
    })

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    wrapper = null

    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('moves focus into the keypad and hides the app from assistive technology', async () => {
    wrapper = mount(LockOverlay, {
      attachTo: document.body,
      global: { plugins: [createPinia()] },
    })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(wrapper.find('[data-pin-key]').element)
    expect(appRoot.inert).toBe(true)
    expect(appRoot.getAttribute('aria-hidden')).toBe('true')

    wrapper.unmount()
    wrapper = null

    expect(appRoot.inert).toBe(false)
    expect(appRoot.hasAttribute('aria-hidden')).toBe(false)
  })
})

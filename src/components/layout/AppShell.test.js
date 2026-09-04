import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppShell from './AppShell.vue'

async function mountAt(meta = {}, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' }, meta }],
  })
  await router.push(path)
  await router.isReady()

  return shallowMount(AppShell, {
    global: {
      plugins: [router],
      stubs: {
        CreateHabitModal: true,
        HelpMascotButton: true,
      },
    },
  })
}

describe('AppShell mobile navigation', () => {
  it('renders the global bottom navigation on ordinary app routes', async () => {
    const wrapper = await mountAt({ title: 'Hoy' })

    expect(wrapper.find('.shell__bottom-wrap').exists()).toBe(true)
    const bottomNav = wrapper.findComponent({ name: 'AuroraBottomNav' })
    expect(bottomNav.exists()).toBe(true)
    expect(bottomNav.props('items').map(({ value, label, shortLabel, path }) => ({ value, label, shortLabel, path }))).toEqual([
      { value: 'home', label: 'Hoy', shortLabel: undefined, path: '/' },
      { value: 'habits', label: 'Hábitos', shortLabel: undefined, path: '/habits' },
      { value: 'rewards', label: 'Recompensas', shortLabel: 'Premios', path: '/rewards' },
      { value: 'history', label: 'Historial', shortLabel: undefined, path: '/progress' },
    ])
    expect(bottomNav.props('items').some(item => item.value === 'new' || item.value === 'settings')).toBe(false)
    expect(wrapper.find('.shell__rail-utility').exists()).toBe(true)
  })

  it('respects hideNav only for focused routes', async () => {
    const wrapper = await mountAt({ title: 'Sesión', hideNav: true })

    expect(wrapper.find('.shell__bottom-wrap').exists()).toBe(false)
  })

  it.each([
    ['/habits', 'habits'],
    ['/habit/demo', 'habits'],
    ['/rewards', 'rewards'],
    ['/progress', 'history'],
  ])('maps %s to the correct primary destination', async (path, active) => {
    const wrapper = await mountAt({}, path)

    expect(wrapper.findComponent({ name: 'AuroraBottomNav' }).props('modelValue')).toBe(active)
  })

  it('announces offline mode without replacing the current screen', async () => {
    const wrapper = await mountAt({ title: 'Hoy' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    await nextTick()

    expect(wrapper.find('.shell__offline').exists()).toBe(true)
    expect(wrapper.find('.shell__content').exists()).toBe(true)
    wrapper.unmount()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })
})

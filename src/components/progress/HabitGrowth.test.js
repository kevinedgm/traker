import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HabitGrowth from './HabitGrowth.vue'

const requiredProps = {
  currentDay: 3,
  duration: 21,
  color: '#32a071',
  icon: 'activity',
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HabitGrowth motion lifecycle', () => {
  it('does not start the animation loop when reduced motion is requested', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame')
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    })

    const wrapper = mount(HabitGrowth, { props: requiredProps })

    expect(requestFrame).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stops the animation loop when the visualization leaves the viewport', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(41)
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')
    let observeChanges
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { observeChanges = callback }
      observe() {}
      disconnect() {}
    })

    const wrapper = mount(HabitGrowth, { props: requiredProps })
    expect(requestFrame).toHaveBeenCalledOnce()

    observeChanges([{ isIntersecting: false }])
    expect(cancelFrame).toHaveBeenCalledWith(41)
    wrapper.unmount()
  })
})

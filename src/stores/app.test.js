import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from './app.js'

describe('app store theme contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it('keeps legacy classes and the Aurora data-theme in sync', () => {
    const store = useAppStore()
    store.setTheme('light')

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})


import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from './useToast.js'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Drain any leftover queue from a previous test.
    const { queue, dismiss } = useToast()
    ;[...queue].forEach(t => dismiss(t.id))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('show() agrega un toast a la cola', () => {
    const { show, queue } = useToast()
    show({ message: 'Hola' })
    expect(queue).toHaveLength(1)
    expect(queue[0].message).toBe('Hola')
  })

  it('dismiss() lo quita de la cola', () => {
    const { show, dismiss, queue } = useToast()
    const id = show({ message: 'Adiós' })
    dismiss(id)
    expect(queue).toHaveLength(0)
  })

  it('se autodescarta después de durationMs', () => {
    const { show, queue } = useToast()
    show({ message: 'Se va solo', durationMs: 1000 })
    expect(queue).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(queue).toHaveLength(0)
  })

  it('durationMs: 0 no se autodescarta', () => {
    const { show, queue } = useToast()
    show({ message: 'Se queda', durationMs: 0 })
    vi.advanceTimersByTime(10_000)
    expect(queue).toHaveLength(1)
  })

  it('action() ejecuta onAction y descarta el toast', () => {
    const { show, action, queue } = useToast()
    const onAction = vi.fn()
    const id = show({ message: 'Con acción', actionLabel: 'Deshacer', onAction, durationMs: 0 })
    action(id)
    expect(onAction).toHaveBeenCalledOnce()
    expect(queue).toHaveLength(0)
  })
})

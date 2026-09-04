import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getNotificationLog,
  runSchedulerTick,
  setCloudDeliveryActive,
  showNotification,
  startScheduler,
  stopScheduler,
} from './notifications.service.js'

describe('local notification scheduler', () => {
  afterEach(() => {
    stopScheduler()
    setCloudDeliveryActive(false)
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('entrega el id de plantilla al banner y al historial local', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    const received = vi.fn()
    window.addEventListener('traker:notification', received)

    await showNotification('Tu resumen está listo', {
      body: 'Guarda lo que sí pasó.',
      data: {
        kind: 'evening_close',
        phraseId: 'notification.evening_close.01',
        copyVersion: '2026.08.31.1',
      },
    })

    expect(received.mock.calls[0][0].detail).toMatchObject({
      phraseId: 'notification.evening_close.01',
      copyVersion: '2026.08.31.1',
    })
    expect(getNotificationLog()[0]).toMatchObject({
      kind: 'evening_close',
      phraseId: 'notification.evening_close.01',
    })
    window.removeEventListener('traker:notification', received)
  })

  it('does not duplicate a reminder when cloud delivery is active', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    })
    const shown = vi.fn()
    window.addEventListener('traker:notification', shown)
    setCloudDeliveryActive(true)
    startScheduler(
      () => [{
        id: 'habit-a',
        name: 'Caminar',
        isActive: true,
        createdAt: '2026-08-01T12:00:00.000Z',
        duration: 60,
        reminder: '08:00',
        reminderDays: [0, 1, 2, 3, 4, 5, 6],
        logs: {},
      }],
      () => ({ notificationsEnabled: true, habitRemindersEnabled: true }),
      () => ({ timezone: 'America/Mexico_City', dayClosure: null }),
    )
    const result = await runSchedulerTick(new Date('2026-08-29T14:00:00.000Z'))
    expect(result.suppression).toBe('cloud_delivery')
    expect(result.intentions).toEqual([])
    expect(shown).not.toHaveBeenCalled()
    window.removeEventListener('traker:notification', shown)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import NotificationsDiagnosticPage from './NotificationsDiagnosticPage.vue'

const mocks = vi.hoisted(() => ({
  getDiagnostics: vi.fn(),
  getNotificationLog: vi.fn(() => []),
  requestPermission: vi.fn(),
  sendTestNotification: vi.fn(),
  ensurePushSubscription: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }))
vi.mock('@stores/auth', () => ({ useAuthStore: () => ({ isCloudAuthenticated: false }) }))
vi.mock('@stores/habits', () => ({ useHabitsStore: () => ({ habits: [] }) }))
vi.mock('@stores/dayClosures', () => ({ useDayClosuresStore: () => ({ forDate: () => null }) }))
vi.mock('@stores/settings', () => ({
  useSettingsStore: () => ({
    $state: {},
    notificationsEnabled: false,
    morningReminderEnabled: false,
    inactivityReminderEnabled: false,
  }),
}))
vi.mock('@services/notifications.service', () => ({
  getDiagnostics: mocks.getDiagnostics,
  getNotificationLog: mocks.getNotificationLog,
  requestPermission: mocks.requestPermission,
  sendTestNotification: mocks.sendTestNotification,
  startScheduler: vi.fn(),
}))
vi.mock('@services/push.service', () => ({
  ensurePushSubscription: mocks.ensurePushSubscription,
  isPushConfigured: () => false,
}))

const diagnostics = {
  permission: 'granted',
  swState: 'active',
  standalone: true,
  pushSubscribed: false,
}

describe('NotificationsDiagnosticPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ensurePushSubscription.mockResolvedValue(undefined)
    mocks.getDiagnostics.mockResolvedValue(diagnostics)
    mocks.sendTestNotification.mockResolvedValue({ ok: true })
  })

  it('recovers from a failed diagnostic refresh', async () => {
    mocks.getDiagnostics.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(NotificationsDiagnosticPage)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Intenta otra vez')
    expect(wrapper.get('[aria-label="Actualizar diagnóstico"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('recovers when sending a test notification throws', async () => {
    mocks.sendTestNotification.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mount(NotificationsDiagnosticPage)
    await flushPromises()
    await wrapper.get('.nd-test-btn').trigger('click')
    await flushPromises()

    expect(wrapper.get('.nd-test-hint[role="alert"]').text()).toContain('Intenta otra vez')
    expect(wrapper.get('.nd-test-btn').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('explains the Home Screen requirement when the iOS standalone capability is present', async () => {
    mocks.getDiagnostics.mockResolvedValue({
      ...diagnostics,
      standalone: false,
      requiresHomeScreenForPush: true,
    })
    const wrapper = mount(NotificationsDiagnosticPage)
    await flushPromises()

    expect(wrapper.text()).toContain('En iPhone, primero añádela a tu pantalla de inicio')
    expect(wrapper.text()).toContain('Compartir → Añadir a pantalla de inicio')
    expect(wrapper.text()).toContain('mientras está abierta')
    wrapper.unmount()
  })
})

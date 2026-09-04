import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  collectSyncV2PilotReadiness,
  acknowledgeResolvedPilotV2Operations,
  loadSyncV2PilotSession,
  loadLatestPilotV2HabitRestoreState,
  pullAll,
  resetSyncV2PilotSession,
  restoreHabitFromPilot,
  mergeHabitsFromCloud,
  mergeRewardsFromCloud,
  saveSyncV2PilotSession,
} = vi.hoisted(() => ({
  collectSyncV2PilotReadiness: vi.fn(),
  acknowledgeResolvedPilotV2Operations: vi.fn(),
  loadSyncV2PilotSession: vi.fn(),
  loadLatestPilotV2HabitRestoreState: vi.fn(),
  pullAll: vi.fn(),
  resetSyncV2PilotSession: vi.fn(),
  restoreHabitFromPilot: vi.fn(),
  mergeHabitsFromCloud: vi.fn(),
  mergeRewardsFromCloud: vi.fn(),
  saveSyncV2PilotSession: vi.fn(),
}))

vi.mock('@/services/syncV2Pilot.service.js', () => ({
  collectSyncV2PilotReadiness,
  loadSyncV2PilotSession,
  resetSyncV2PilotSession,
  saveSyncV2PilotSession,
  SYNC_V2_PILOT_MATRIX: Array.from({ length: 5 }, (_, index) => ({ id: `case-${index}` })),
}))
vi.mock('@/services/local/v2.export.js', () => ({ exportV2Data: vi.fn() }))
vi.mock('@/services/syncV2PilotBridge.service.js', () => ({
  acknowledgeResolvedPilotV2Operations,
  loadLatestPilotV2HabitRestoreState,
}))
vi.mock('@/services/supabase/sync.service.js', () => ({ pullAll }))
vi.mock('@stores/habits', () => ({
  useHabitsStore: () => ({ restoreHabitFromPilot, mergeFromCloud: mergeHabitsFromCloud }),
}))
vi.mock('@stores/rewards', () => ({
  useRewardsStore: () => ({ mergeFromCloud: mergeRewardsFromCloud }),
}))

import SyncV2PilotPage from './SyncV2PilotPage.vue'

const matrix = Array.from({ length: 5 }, (_, index) => ({
  id: `case-${index}`,
  action: `Caso ${index + 1}`,
  expected: `Resultado ${index + 1}`,
}))

describe('SyncV2PilotPage', () => {
  beforeEach(() => {
    collectSyncV2PilotReadiness.mockReset()
    acknowledgeResolvedPilotV2Operations.mockReset().mockResolvedValue({ acknowledged: 1, remaining: 0 })
    loadSyncV2PilotSession.mockReset().mockResolvedValue(null)
    loadLatestPilotV2HabitRestoreState.mockReset().mockResolvedValue({ state: 'idle', habit: null })
    pullAll.mockReset().mockResolvedValue({ habits: [], rewards: { claims: [] } })
    resetSyncV2PilotSession.mockReset().mockResolvedValue(undefined)
    restoreHabitFromPilot.mockReset().mockResolvedValue({ status: 'synced' })
    mergeHabitsFromCloud.mockReset()
    mergeRewardsFromCloud.mockReset()
    saveSyncV2PilotSession.mockReset().mockResolvedValue(undefined)
    collectSyncV2PilotReadiness.mockResolvedValue({
      ready: true,
      backfillReady: true,
      converged: true,
      environment: 'localhost',
      serverReachable: true,
      server: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
      local: {
        migrationStatus: 'completed',
        habits: 2,
        habitLogs: 3,
        unresolvedOperations: 0,
        pendingOperations: 0,
        operationStates: { pending: 0, conflict: 0, rejected: 0, blocked: 0, unknown: 0 },
      },
      matrix,
    })
  })

  it('never displays zero when the server report is incomplete', async () => {
    collectSyncV2PilotReadiness.mockResolvedValue({
      ready: false,
      backfillReady: false,
      converged: false,
      environment: 'localhost',
      serverReachable: true,
      server: {},
      local: { migrationStatus: 'completed', habits: 0, habitLogs: 0, pendingOperations: 0 },
      matrix,
    })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Reporte incompleto')
  })

  it('offers a direct local sign-in action when the private report is unavailable', async () => {
    collectSyncV2PilotReadiness.mockResolvedValue({
      ready: false,
      backfillReady: false,
      converged: false,
      environment: 'localhost',
      serverReachable: false,
      errorCode: '42501',
      server: null,
      local: { migrationStatus: 'completed', habits: 1, habitLogs: 1, pendingOperations: 1 },
      matrix,
    })
    const wrapper = mount(SyncV2PilotPage, {
      global: {
        stubs: {
          SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' },
          RouterLink: { props: ['to'], template: '<a><slot/></a>' },
        },
      },
    })
    await flushPromises()

    const signIn = wrapper.find('.sv-session-link')
    expect(signIn.exists()).toBe(true)
    expect(signIn.text()).toContain('Iniciar sesión')
    expect(wrapper.text()).toContain('Requiere sesión local')
  })

  it('shows content-free readiness counts and the complete manual matrix', async () => {
    const wrapper = mount(SyncV2PilotPage, {
      global: {
        stubs: {
          SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Convergencia lista')
    expect(wrapper.text()).toContain('2 hábitos · 3 logs')
    expect(wrapper.text()).toContain('0/5')
    expect(wrapper.findAll('.sv-check')).toHaveLength(5)
    expect(wrapper.find('.sv-restore').exists()).toBe(false)
  })

  it('distinguishes a terminal conflict from a retryable pending operation', async () => {
    collectSyncV2PilotReadiness.mockResolvedValue({
      ready: false,
      backfillReady: true,
      converged: false,
      environment: 'localhost',
      serverReachable: true,
      server: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
      local: {
        migrationStatus: 'completed',
        habits: 2,
        habitLogs: 3,
        unresolvedOperations: 1,
        pendingOperations: 1,
        operationStates: { pending: 0, conflict: 1, rejected: 0, blocked: 0, unknown: 0 },
      },
      matrix,
    })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Backfill listo · sync pendiente')
    expect(wrapper.text()).toContain('1 en conflicto')
    expect(wrapper.text()).not.toContain('1 pendiente')
    expect(wrapper.find('.sv-reconcile').text()).toContain('Usar copia de Supabase')
  })

  it('closes only a conflict that the bridge confirms as locally converged', async () => {
    collectSyncV2PilotReadiness
      .mockResolvedValueOnce({
        ready: false,
        backfillReady: true,
        converged: false,
        environment: 'localhost',
        serverReachable: true,
        server: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
        local: {
          migrationStatus: 'completed',
          habits: 2,
          habitLogs: 3,
          unresolvedOperations: 1,
          pendingOperations: 1,
          operationStates: { pending: 0, conflict: 1, rejected: 0, blocked: 0, unknown: 0 },
        },
        matrix,
      })
      .mockResolvedValueOnce({
        ready: true,
        backfillReady: true,
        converged: true,
        environment: 'localhost',
        serverReachable: true,
        server: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
        local: {
          migrationStatus: 'completed',
          habits: 2,
          habitLogs: 3,
          unresolvedOperations: 0,
          pendingOperations: 0,
          operationStates: { pending: 0, conflict: 0, rejected: 0, blocked: 0, unknown: 0 },
        },
        matrix,
      })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()
    await wrapper.find('.sv-reconcile').trigger('click')
    await flushPromises()

    expect(pullAll).toHaveBeenCalledOnce()
    expect(mergeHabitsFromCloud).toHaveBeenCalledWith([], { preferCloud: true })
    expect(mergeRewardsFromCloud).toHaveBeenCalledWith({ claims: [] })
    expect(acknowledgeResolvedPilotV2Operations).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Convergencia lista')
    expect(wrapper.find('.sv-reconcile').exists()).toBe(false)
  })

  it('keeps terminal operations intact when the canonical snapshot cannot refresh', async () => {
    collectSyncV2PilotReadiness.mockResolvedValue({
      ready: false,
      backfillReady: true,
      converged: false,
      environment: 'localhost',
      serverReachable: true,
      server: { missingLegacyLogs: 0, missingReminderSchedules: 0 },
      local: {
        migrationStatus: 'completed',
        habits: 2,
        habitLogs: 3,
        unresolvedOperations: 2,
        operationStates: { pending: 0, conflict: 0, rejected: 2, blocked: 0, unknown: 0 },
      },
      matrix,
    })
    pullAll.mockResolvedValue(null)
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()
    await wrapper.find('.sv-reconcile').trigger('click')
    await flushPromises()

    expect(acknowledgeResolvedPilotV2Operations).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Las operaciones siguen intactas')
    expect(wrapper.text()).toContain('2 rechazadas')
  })

  it('exposes labelled regions and keyboard-native matrix controls', async () => {
    const wrapper = mount(SyncV2PilotPage, {
      global: {
        stubs: {
          SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' },
        },
      },
    })
    await flushPromises()

    const sections = wrapper.findAll('section[aria-labelledby]')
    expect(sections).toHaveLength(3)
    for (const section of sections) {
      const headingId = section.attributes('aria-labelledby')
      expect(section.find(`#${headingId}`).element.tagName).toBe('H2')
    }

    const checks = wrapper.findAll('.sv-check')
    expect(checks).toHaveLength(5)
    for (const [index, check] of checks.entries()) {
      expect(check.element.tagName).toBe('BUTTON')
      expect(check.attributes()).toMatchObject({
        type: 'button',
        role: 'checkbox',
        'aria-checked': 'false',
      })
      expect(check.text()).toContain(`Caso ${index + 1}`)
      expect(check.text()).toContain(`Resultado ${index + 1}`)
    }
  })

  it('requires all observed cases before presenting human review readiness', async () => {
    const wrapper = mount(SyncV2PilotPage, {
      global: {
        stubs: {
          SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' },
        },
      },
    })
    await flushPromises()

    for (const button of wrapper.findAll('.sv-check')) await button.trigger('click')

    expect(wrapper.text()).toContain('5/5')
    expect(wrapper.text()).toContain('Sync v2 local está activo')
    expect(saveSyncV2PilotSession).toHaveBeenCalledTimes(5)
  })

  it('restores saved manual checks on mount', async () => {
    loadSyncV2PilotSession.mockResolvedValue({
      checks: { 'case-0': { completedAt: '2026-08-29T17:00:00.000Z' } },
    })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('1/5')
    expect(wrapper.findAll('.sv-check')[0].attributes('aria-checked')).toBe('true')
  })

  it('offers a bounded restore action only when a local tombstone exists', async () => {
    const tombstone = {
      id: 'habit-deleted',
      name: 'Privado',
      version: 3,
      deletedAt: '2026-08-29T18:00:00.000Z',
    }
    loadLatestPilotV2HabitRestoreState
      .mockResolvedValueOnce({ state: 'idle', habit: tombstone })
      .mockResolvedValueOnce({ state: 'idle', habit: null })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()

    const button = wrapper.find('.sv-restore__button')
    expect(button.text()).toContain('Restaurar hábito')
    expect(wrapper.text()).not.toContain('Privado')
    await button.trigger('click')
    await flushPromises()

    expect(restoreHabitFromPilot).toHaveBeenCalledWith(tombstone)
    expect(wrapper.text()).toContain('Restauración aceptada')
  })

  it('removes the stale restore action after a version conflict', async () => {
    loadLatestPilotV2HabitRestoreState.mockResolvedValue({
      state: 'idle',
      habit: {
        id: 'habit-deleted',
        version: 3,
        deletedAt: '2026-08-29T18:00:00.000Z',
      },
    })
    restoreHabitFromPilot.mockResolvedValue({ status: 'conflict' })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()
    await wrapper.find('.sv-restore__button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.sv-restore__button').exists()).toBe(false)
    expect(wrapper.text()).toContain('La versión local quedó intacta')
    expect(wrapper.text()).toContain('Conservamos el conflicto')
  })

  it('keeps a pending restore queued after remount without offering a duplicate action', async () => {
    loadLatestPilotV2HabitRestoreState.mockResolvedValue({
      state: 'queued',
      habit: null,
      operationId: 'operation-restore',
    })
    const wrapper = mount(SyncV2PilotPage, {
      global: { stubs: { SettingsShell: { template: '<main><slot name="actions"/><slot/></main>' } } },
    })
    await flushPromises()

    expect(wrapper.find('.sv-restore').exists()).toBe(true)
    expect(wrapper.find('.sv-restore__button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Restauración guardada en la cola local')
    expect(restoreHabitFromPilot).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/config/features.js', () => ({ features: { goals: false } }))
vi.mock('@services/supabase/sync.service.js', () => ({ push: vi.fn() }))

import RewardsPage from './RewardsPage.vue'
import { useRewardsStore } from '@stores/rewards'

describe('RewardsPage voluntary claim use', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('keeps a claim in the vault until its explicit Use action', async () => {
    const rewardsStore = useRewardsStore()
    rewardsStore.claims = [{
      id: 'claim-1',
      rewardId: 'reward-1',
      ruleId: 'rule-1',
      rewardName: 'Una tarde libre',
      rewardNote: 'Sin pendientes',
      periodKey: 'week:2026-08-24',
      unlockedAt: '2026-08-30T12:00:00.000Z',
      usedAt: null,
      redeemedAt: null,
    }]

    const wrapper = mount(RewardsPage, {
      global: {
        plugins: [pinia],
        stubs: {
          AuroraModal: true,
          AuroraConfirmDialog: true,
          RewardForm: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Una tarde libre')
    expect(rewardsStore.claims[0].usedAt).toBeNull()

    await wrapper.get('button[aria-label="Usar Una tarde libre"]').trigger('click')

    expect(rewardsStore.claims[0].usedAt).toEqual(expect.any(String))
    expect(rewardsStore.availableClaims).toHaveLength(0)
    expect(wrapper.text()).toContain('Disfrutadas recientemente')
  })
})

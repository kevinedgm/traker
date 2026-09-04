import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { qualifyingCycle, useRewardsStore } from './rewards'
import { push } from '@services/supabase/sync.service.js'

vi.mock('@services/supabase/sync.service.js', () => ({ push: vi.fn() }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${Math.random()}`) })
  vi.mocked(push).mockClear()
})

const habit = {
  id: 'gym',
  createdAt: '2026-08-24T10:00:00.000Z',
  logs: { 1: { level: 2 }, 2: { level: 1 }, 3: { level: 3 } },
}

describe('rewards', () => {
  it('qualifies a daily habit reward from today\'s built log', () => {
    const cycle = qualifyingCycle({ enabled: true, trigger: 'habit_daily', sourceId: 'gym' }, [habit], [], new Date(2026, 7, 26))
    expect(cycle).toBe('day:2026-08-26')
  })

  it('qualifies a weekly reward after the requested number of built days', () => {
    const cycle = qualifyingCycle({ enabled: true, trigger: 'habit_weekly', sourceId: 'gym', targetCount: 3 }, [habit], [], new Date(2026, 7, 27))
    expect(cycle).toBe('week:2026-08-24')
  })

  it('creates one claim per cycle and lets the user redeem it', () => {
    const store = useRewardsStore()
    store.addReward({ name: 'Una tlayuda', trigger: 'habit_weekly', sourceId: 'gym', targetCount: 3 })
    expect(store.evaluate([habit], [], new Date(2026, 7, 27))).toHaveLength(1)
    expect(store.evaluate([habit], [], new Date(2026, 7, 27))).toHaveLength(0)
    expect(store.availableClaims).toHaveLength(1)
    store.redeem(store.availableClaims[0].id)
    expect(store.availableClaims).toHaveLength(0)
  })

  it('keeps an unlocked claim available until the user explicitly uses it', () => {
    const store = useRewardsStore()
    store.addReward({ name: 'Una tlayuda', trigger: 'habit_weekly', sourceId: 'gym', targetCount: 3 })
    const [claim] = store.evaluate([habit], [], new Date(2026, 7, 27))

    store.evaluate([habit], [], new Date(2026, 8, 3))

    expect(claim.usedAt).toBeNull()
    expect(store.availableClaims).toContainEqual(expect.objectContaining({ id: claim.id }))
    vi.mocked(push).mockClear()
    store.redeem(claim.id)
    expect(push).toHaveBeenCalledWith('upsert-reward-claim', {
      claim: expect.objectContaining({ id: claim.id, usedAt: expect.any(String) }),
    })
  })

  it('qualifies a completed goal once', () => {
    const reward = { enabled: true, trigger: 'goal_completed', sourceId: 'goal-1' }
    expect(qualifyingCycle(reward, [], [{ id: 'goal-1', status: 'completed' }])).toBe('goal:goal-1')
  })

  it('qualifies a completed milestone with a cloud-compatible source', () => {
    const reward = { enabled: true, trigger: 'milestone_completed', sourceId: 'milestone-1' }
    const context = { milestones: [{ id: 'milestone-1', status: 'completed', evidenceSummary: 'Publicado' }] }

    expect(qualifyingCycle(reward, [], [], new Date(2026, 7, 27), context)).toBe('milestone:milestone-1')
    const store = useRewardsStore()
    store.addReward({ name: 'Tarde libre', trigger: 'milestone_completed', sourceId: 'milestone-1' })
    expect(push).toHaveBeenCalledWith('upsert-reward', { reward: expect.objectContaining({ trigger: 'milestone_completed' }) })
  })

  it('unlocks a deterministic two-of-three habit rule', () => {
    const habits = [
      habit,
      { ...habit, id: 'walk' },
      { ...habit, id: 'write', logs: {} },
    ]
    const reward = {
      enabled: true,
      trigger: 'habits_combo',
      sourceIds: ['gym', 'walk', 'write'],
      targetCount: 2,
    }
    expect(qualifyingCycle(reward, habits, [], new Date(2026, 7, 26))).toBe('day:2026-08-26')
  })

  it('creates one idempotent claim from a deterministic two-of-three rule', () => {
    const store = useRewardsStore()
    store.addReward({
      name: 'Una tarde libre',
      trigger: 'habits_combo',
      sourceIds: ['gym', 'walk', 'write'],
      targetCount: 2,
    })
    const habits = [habit, { ...habit, id: 'walk' }, { ...habit, id: 'write', logs: {} }]

    expect(store.evaluate(habits, [], new Date(2026, 7, 26))).toHaveLength(1)
    expect(store.evaluate(habits, [], new Date(2026, 7, 26))).toHaveLength(0)
    expect(store.availableClaims).toHaveLength(1)
  })

  it('does not lower a multi-source threshold when one source was deleted', () => {
    const reward = {
      enabled: true,
      trigger: 'habits_combo',
      sourceIds: ['gym', 'deleted-habit'],
      targetCount: 1,
    }

    expect(qualifyingCycle(reward, [habit], [], new Date(2026, 7, 26))).toBeNull()
  })

  it('unlocks a sufficient-day reward only when the day is explicitly closed', () => {
    const store = useRewardsStore()
    store.addReward({ name: 'Escuchar un disco', trigger: 'day_sufficient' })
    expect(store.evaluate([habit], [], new Date(2026, 7, 26))).toHaveLength(0)
    const context = { dayClosure: { status: 'sufficient' } }
    expect(store.evaluate([habit], [], new Date(2026, 7, 26), context)).toHaveLength(1)
    expect(store.evaluate([habit], [], new Date(2026, 7, 26), context)).toHaveLength(0)
  })

  it('unlocks a reward when a flexible group reaches its period minimum', () => {
    const flexibleHabit = {
      ...habit,
      logs: { 1: { level: 3, localDate: '2026-08-24' } },
    }
    const reward = {
      enabled: true,
      trigger: 'flexible_group',
      sourceId: 'group-1',
      groupPeriod: 'week',
    }
    const context = {
      flexibleGroups: [{ id: 'group-1', name: 'Movimiento', minimumCount: 1, memberIds: ['gym'] }],
    }
    expect(qualifyingCycle(reward, [flexibleHabit], [], new Date(2026, 7, 26), context)).toBe('flex:group-1:2026-08-24')
  })

  it('uses a new cycle key on another day and another week', () => {
    const daily = { enabled: true, trigger: 'habit_daily', sourceId: 'gym' }
    expect(qualifyingCycle(daily, [habit], [], new Date(2026, 7, 25))).toBe('day:2026-08-25')
    const nextWeekHabit = { ...habit, logs: { 8: { level: 1 }, 9: { level: 2 }, 10: { level: 3 } } }
    const weekly = { enabled: true, trigger: 'habit_weekly', sourceId: 'gym', targetCount: 3 }
    expect(qualifyingCycle(weekly, [nextWeekHabit], [], new Date(2026, 8, 3))).toBe('week:2026-08-31')
  })

  it('respects pause, editing and deletion without touching habits', () => {
    const store = useRewardsStore()
    const reward = store.addReward({ name: 'Una coca', trigger: 'habit_daily', sourceId: 'gym' })
    const ruleId = reward.rule.id
    store.updateReward(reward.id, { enabled: false, name: 'Una coca fría' })
    expect(store.evaluate([habit], [], new Date(2026, 7, 26))).toHaveLength(0)
    expect(store.rewards[0].name).toBe('Una coca fría')
    expect(store.rewards[0].rule.id).toBe(ruleId)
    store.removeReward(reward.id)
    expect(store.rewards).toHaveLength(0)
    expect(habit.logs[3].level).toBe(3)
  })

  it('deletes the remote definition when a cloud rule becomes a local-only goal rule', () => {
    const store = useRewardsStore()
    const reward = store.addReward({ name: 'Descanso', trigger: 'habit_daily', sourceId: 'gym' })
    vi.mocked(push).mockClear()

    store.updateReward(reward.id, { trigger: 'goal_completed', sourceId: 'goal-1', sourceIds: ['goal-1'] })

    expect(push).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledWith('delete-reward', { rewardId: reward.id })
  })

  it('keeps goal claims local when they are used', () => {
    const store = useRewardsStore()
    store.addReward({ name: 'Paseo', trigger: 'goal_completed', sourceId: 'goal-1' })
    const [claim] = store.evaluate([], [{ id: 'goal-1', status: 'completed' }])
    vi.mocked(push).mockClear()

    store.redeem(claim.id)

    expect(push).not.toHaveBeenCalled()
  })

})

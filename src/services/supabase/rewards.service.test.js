import { describe, expect, it } from 'vitest'
import {
  fromRemoteRewardsBundle,
  toRemoteClaim,
  toRemoteReward,
  toRemoteRule,
  toRemoteSource,
} from './rewards.service.js'

const reward = {
  id: 'reward-1',
  name: 'Una tarde de lectura',
  note: 'Sin pendientes',
  status: 'active',
  version: 2,
  createdAt: '2026-08-29T12:00:00Z',
  updatedAt: '2026-08-29T13:00:00Z',
  rule: {
    id: 'rule-1',
    ruleType: 'at_least',
    threshold: 2,
    period: 'day',
    sources: [
      { id: 'source-1', type: 'habit', sourceId: 'habit-1' },
      { id: 'source-2', type: 'habit', sourceId: 'habit-2' },
      { id: 'source-3', type: 'habit', sourceId: 'habit-3' },
    ],
  },
}

describe('Supabase reward mappings', () => {
  it('maps a deterministic two-of-three rule without flattening its sources', () => {
    expect(toRemoteReward(reward, 'user-1')).toMatchObject({ name: reward.name, status: 'active' })
    expect(toRemoteRule(reward, 'user-1')).toMatchObject({
      rule_type: 'at_least',
      threshold: 2,
      period: 'day',
    })
    expect(toRemoteSource(reward.rule.sources[0], reward.rule.id, 'user-1')).toMatchObject({
      rule_id: 'rule-1',
      habit_id: 'habit-1',
      milestone_id: null,
    })
  })

  it('keeps legacy goal sources local until they become canonical milestones', () => {
    expect(toRemoteSource({ type: 'goal', sourceId: 'goal-1' }, 'rule-1', 'user-1')).toBeNull()
  })

  it('hydrates rewards and claims from one batched bundle', () => {
    const result = fromRemoteRewardsBundle({
      rewards: [{ id: 'reward-1', name: 'Descanso', description: '', safety_note: '', status: 'active', version: 1, created_at: '2026-08-29T12:00:00Z', updated_at: '2026-08-29T12:00:00Z' }],
      rules: [{ id: 'rule-1', reward_id: 'reward-1', rule_type: 'day_sufficient', threshold: null, period: 'day', active_from: '2026-08-29', active_until: null, version: 1 }],
      sources: [],
      claims: [{ id: 'claim-1', rule_id: 'rule-1', period_key: 'day:2026-08-29', unlocked_at: '2026-08-30T02:00:00Z', claimed_at: '2026-08-30T02:00:00Z', used_at: null }],
    })
    expect(result.rewards[0].trigger).toBe('day_sufficient')
    expect(result.claims[0]).toMatchObject({ rewardId: 'reward-1', rewardName: 'Descanso' })
  })

  it('maps a claim with an explicit voluntary use time', () => {
    expect(toRemoteClaim({
      id: 'claim-1',
      ruleId: 'rule-1',
      periodKey: 'day:2026-08-29',
      unlockedAt: '2026-08-30T02:00:00Z',
      claimedAt: '2026-08-30T02:00:00Z',
      usedAt: '2026-08-30T03:00:00Z',
    }, 'user-1')).toMatchObject({ used_at: '2026-08-30T03:00:00Z' })
  })
})

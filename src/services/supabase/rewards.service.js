import { normalizeReward, normalizeRewardClaim } from '@/features/rewards/domain.js'
import { supabase } from './client.js'

function success(data = null) {
  return { data, error: null }
}

function sourceKey(source) {
  return `${source.type}:${source.sourceId}`
}

export function toRemoteReward(reward, userId) {
  return {
    id: reward.id,
    user_id: userId,
    name: reward.name,
    description: reward.note ?? '',
    safety_note: reward.safetyNote ?? '',
    status: reward.status ?? (reward.enabled === false ? 'paused' : 'active'),
    version: Math.max(1, Number(reward.version) || 1),
    created_at: reward.createdAt,
    updated_at: reward.updatedAt,
    deleted_at: reward.deletedAt ?? null,
  }
}

export function toRemoteRule(reward, userId) {
  const { rule } = normalizeReward(reward)
  return {
    id: rule.id,
    user_id: userId,
    reward_id: reward.id,
    rule_type: rule.ruleType,
    threshold: rule.ruleType === 'at_least' ? rule.threshold : null,
    period: rule.period,
    active_from: rule.activeFrom ?? String(reward.createdAt ?? new Date().toISOString()).slice(0, 10),
    active_until: rule.activeUntil ?? null,
    version: Math.max(1, Number(rule.version) || 1),
    created_at: reward.createdAt,
    updated_at: reward.updatedAt,
    deleted_at: reward.deletedAt ?? null,
  }
}

export function toRemoteSource(source, ruleId, userId) {
  const column = {
    habit: 'habit_id',
    flex_group: 'flexible_group_id',
    milestone: 'milestone_id',
  }[source.type]
  if (!column || !source.sourceId) return null
  return {
    id: source.id,
    user_id: userId,
    rule_id: ruleId,
    habit_id: null,
    flexible_group_id: null,
    milestone_id: null,
    [column]: source.sourceId,
    deleted_at: null,
  }
}

export function toRemoteClaim(claim, userId) {
  return {
    id: claim.id,
    user_id: userId,
    rule_id: claim.ruleId,
    period_key: claim.periodKey,
    unlocked_at: claim.unlockedAt,
    claimed_at: claim.claimedAt ?? claim.unlockedAt,
    used_at: claim.usedAt ?? null,
  }
}

function fromRemoteSource(row) {
  if (row.habit_id) return { id: row.id, type: 'habit', sourceId: row.habit_id }
  if (row.flexible_group_id) return { id: row.id, type: 'flex_group', sourceId: row.flexible_group_id }
  if (row.milestone_id) return { id: row.id, type: 'milestone', sourceId: row.milestone_id }
  return null
}

export function fromRemoteRewardsBundle({ rewards = [], rules = [], sources = [], claims = [] } = {}) {
  const localRewards = rewards.map(row => {
    const ruleRow = rules.find(rule => rule.reward_id === row.id)
    const ruleSources = ruleRow
      ? sources.filter(source => source.rule_id === ruleRow.id).map(fromRemoteSource).filter(Boolean)
      : []
    return normalizeReward({
      id: row.id,
      name: row.name,
      note: row.description,
      safetyNote: row.safety_note,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: row.deleted_at,
      rule: ruleRow ? {
        id: ruleRow.id,
        ruleType: ruleRow.rule_type,
        threshold: ruleRow.threshold,
        period: ruleRow.period,
        activeFrom: ruleRow.active_from,
        activeUntil: ruleRow.active_until,
        version: ruleRow.version,
        sources: ruleSources,
      } : undefined,
    })
  })
  const rewardByRule = new Map(localRewards.map(reward => [reward.rule.id, reward]))
  const localClaims = claims.map(row => {
    const reward = rewardByRule.get(row.rule_id)
    return normalizeRewardClaim({
      id: row.id,
      rewardId: reward?.id,
      ruleId: row.rule_id,
      rewardName: reward?.name,
      rewardNote: reward?.note,
      periodKey: row.period_key,
      unlockedAt: row.unlocked_at,
      claimedAt: row.claimed_at,
      usedAt: row.used_at,
    }, reward)
  })
  return { rewards: localRewards, claims: localClaims }
}

export async function fetchRewardsBundle() {
  if (!supabase) return success({ rewards: [], rules: [], sources: [], claims: [] })
  const [rewards, rules, sources, claims] = await Promise.all([
    supabase.from('traker_rewards').select('*').is('deleted_at', null),
    supabase.from('traker_reward_rules').select('*').is('deleted_at', null),
    supabase.from('traker_reward_rule_sources').select('*').is('deleted_at', null),
    supabase.from('traker_reward_claims').select('*'),
  ])
  const failure = [rewards, rules, sources, claims].find(result => result.error)
  if (failure) return failure
  return success(fromRemoteRewardsBundle({
    rewards: rewards.data,
    rules: rules.data,
    sources: sources.data,
    claims: claims.data,
  }))
}

async function syncRuleSources(reward, userId) {
  const desired = reward.rule.sources
    .map(source => ({ local: source, row: toRemoteSource(source, reward.rule.id, userId) }))
    .filter(item => item.row)
  const existing = await supabase
    .from('traker_reward_rule_sources')
    .select('*')
    .eq('rule_id', reward.rule.id)
  if (existing.error) return existing

  const existingByKey = new Map((existing.data ?? []).map(row => [sourceKey(fromRemoteSource(row) ?? {}), row]))
  const desiredKeys = new Set(desired.map(item => sourceKey(item.local)))
  const now = new Date().toISOString()

  for (const row of existing.data ?? []) {
    const local = fromRemoteSource(row)
    if (local && !row.deleted_at && !desiredKeys.has(sourceKey(local))) {
      const result = await supabase.from('traker_reward_rule_sources').update({ deleted_at: now }).eq('id', row.id)
      if (result.error) return result
    }
  }

  for (const item of desired) {
    const prior = existingByKey.get(sourceKey(item.local))
    const row = prior ? { ...item.row, id: prior.id } : item.row
    const result = await supabase.from('traker_reward_rule_sources').upsert(row, { onConflict: 'id' })
    if (result.error) return result
  }
  return success()
}

export async function upsertRewardBundle(input, userId) {
  if (!supabase) return success()
  const reward = normalizeReward(input)
  if (reward.rule.sources.some(source => source.type === 'goal')) return success({ localOnly: true })
  const rewardResult = await supabase
    .from('traker_rewards')
    .upsert(toRemoteReward(reward, userId), { onConflict: 'id' })
  if (rewardResult.error) return rewardResult

  const ruleResult = await supabase
    .from('traker_reward_rules')
    .upsert(toRemoteRule(reward, userId), { onConflict: 'id' })
  if (ruleResult.error) return ruleResult
  return syncRuleSources(reward, userId)
}

export async function upsertRewardClaim(input, userId) {
  if (!supabase) return success()
  const claim = normalizeRewardClaim(input)
  const row = toRemoteClaim(claim, userId)
  delete row.id
  return supabase
    .from('traker_reward_claims')
    .upsert(row, { onConflict: 'user_id,rule_id,period_key' })
}

export async function deleteReward(rewardId) {
  if (!supabase) return success()
  return supabase.from('traker_rewards').delete().eq('id', rewardId)
}

export async function bulkUpsertRewards(rewards, claims, userId) {
  if (!supabase) return success()
  const eligibleRewards = (rewards ?? [])
    .map(normalizeReward)
    .filter(reward => !reward.rule.sources.some(source => source.type === 'goal'))
  const eligibleRuleIds = new Set(eligibleRewards.map(reward => reward.rule.id))
  for (const reward of eligibleRewards) {
    const result = await upsertRewardBundle(reward, userId)
    if (result.error) return result
  }
  const eligibleClaims = (claims ?? []).filter(claim => eligibleRuleIds.has(claim.ruleId))
  if (eligibleClaims.length) {
    const rows = eligibleClaims.map(claim => {
      const row = toRemoteClaim(normalizeRewardClaim(claim), userId)
      delete row.id
      return row
    })
    return supabase
      .from('traker_reward_claims')
      .upsert(rows, {
        onConflict: 'user_id,rule_id,period_key',
      })
  }
  return success()
}

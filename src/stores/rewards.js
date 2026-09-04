import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { push } from '@services/supabase/sync.service.js'
import {
  normalizeReward,
  normalizeRewardClaim,
  qualifyingCycle,
} from '@/features/rewards/domain.js'

function timestamp(value) {
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : 0
}

export { qualifyingCycle }

function cloudEligible(reward) {
  return !reward.rule.sources.some(source => source.type === 'goal')
}

export const useRewardsStore = defineStore('rewards', () => {
  const rewards = ref([])
  const claims = ref([])

  const activeRewards = computed(() => rewards.value.filter(reward => reward.enabled && !reward.deletedAt))
  const availableClaims = computed(() => claims.value.filter(claim => !claim.usedAt))
  const redeemedClaims = computed(() => claims.value
    .filter(claim => claim.usedAt)
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt)))

  function addReward(input) {
    const reward = normalizeReward(input)
    if (!reward.name || (reward.rule.ruleType !== 'day_sufficient' && !reward.rule.sources.length)) return null
    rewards.value.push(reward)
    if (cloudEligible(reward)) push('upsert-reward', { reward })
    return reward
  }

  function updateReward(id, patch) {
    const index = rewards.value.findIndex(reward => reward.id === id)
    if (index < 0) return null
    const current = rewards.value[index]
    const reward = normalizeReward({
      ...current,
      ...patch,
      id,
      rule: patch.rule,
      status: patch.status ?? (typeof patch.enabled === 'boolean' ? (patch.enabled ? 'active' : 'paused') : current.status),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    })
    reward.rule.id = current.rule.id
    reward.rule.version = current.rule.version + 1
    rewards.value[index] = reward
    if (cloudEligible(reward)) push('upsert-reward', { reward })
    else if (cloudEligible(current)) push('delete-reward', { rewardId: id })
    return reward
  }

  function removeReward(id) {
    rewards.value = rewards.value.filter(reward => reward.id !== id)
    claims.value = claims.value.filter(claim => claim.rewardId !== id)
    push('delete-reward', { rewardId: id })
  }

  function evaluate(habits = [], goals = [], now = new Date(), context = {}) {
    const created = []
    for (const reward of activeRewards.value) {
      const cycleKey = qualifyingCycle(reward, habits, goals, now, context)
      if (!cycleKey || claims.value.some(claim => claim.ruleId === reward.rule.id && claim.periodKey === cycleKey)) continue
      const claim = normalizeRewardClaim({ periodKey: cycleKey, unlockedAt: new Date(now).toISOString() }, reward)
      claims.value.push(claim)
      created.push(claim)
      if (cloudEligible(reward)) push('upsert-reward-claim', { claim })
    }
    return created
  }

  function redeem(claimId) {
    const claim = claims.value.find(item => item.id === claimId)
    if (!claim || claim.usedAt) return null
    const usedAt = new Date().toISOString()
    claim.usedAt = usedAt
    claim.redeemedAt = usedAt
    const reward = rewards.value.find(item => item.id === claim.rewardId || item.rule.id === claim.ruleId)
    if (reward && cloudEligible(reward)) push('upsert-reward-claim', { claim })
    return claim
  }

  function mergeFromCloud(bundle = {}) {
    for (const raw of bundle.rewards ?? []) {
      const incoming = normalizeReward(raw)
      const local = rewards.value.find(reward => reward.id === incoming.id)
      if (!local) rewards.value.push(incoming)
      else if (timestamp(incoming.updatedAt) > timestamp(local.updatedAt)) Object.assign(local, incoming)
    }
    for (const raw of bundle.claims ?? []) {
      const reward = rewards.value.find(item => item.id === raw.rewardId)
      const incoming = normalizeRewardClaim(raw, reward)
      const local = claims.value.find(claim => claim.id === incoming.id || (claim.ruleId === incoming.ruleId && claim.periodKey === incoming.periodKey))
      if (!local) claims.value.push(incoming)
      else if (timestamp(incoming.usedAt ?? incoming.unlockedAt) > timestamp(local.usedAt ?? local.unlockedAt)) Object.assign(local, incoming)
    }
  }

  function clearAllRewards() {
    const ids = rewards.value.map(reward => reward.id)
    rewards.value = []
    claims.value = []
    for (const rewardId of ids) push('delete-reward', { rewardId })
  }

  return {
    rewards,
    claims,
    activeRewards,
    availableClaims,
    redeemedClaims,
    addReward,
    updateReward,
    removeReward,
    evaluate,
    redeem,
    mergeFromCloud,
    clearAllRewards,
  }
}, {
  persist: {
    key: 'traker:rewards',
    pick: ['rewards', 'claims'],
    serialize: state => ({
      rewards: state.rewards.map(normalizeReward),
      claims: state.claims.map(claim => normalizeRewardClaim(claim, state.rewards.find(reward => reward.id === claim.rewardId))),
    }),
    deserialize: saved => {
      const rewards = Array.isArray(saved?.rewards) ? saved.rewards.map(normalizeReward) : []
      return {
        rewards,
        claims: Array.isArray(saved?.claims)
          ? saved.claims.map(claim => normalizeRewardClaim(claim, rewards.find(reward => reward.id === claim.rewardId)))
          : [],
      }
    },
  },
})

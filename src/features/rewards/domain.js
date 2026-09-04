import { dayNumberForLocalDate, localDateKey } from '@/features/habits/domain.js'
import { flexibleGroupProgress } from '@/features/flexibleGroups/domain.js'

const BUILD_LEVELS = new Set([1, 2, 3])
const RULE_TYPES = new Set(['all', 'at_least', 'milestone', 'day_sufficient'])
const PERIODS = new Set(['instant', 'day', 'week', 'month', 'once'])

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const random = Math.floor(Math.random() * 16)
      return (token === 'x' ? random : ((random & 0x3) | 0x8)).toString(16)
    })
}

function dateKey(value = new Date()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekKey(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return dateKey(date)
}

function monthKey(value = new Date()) {
  return dateKey(value).slice(0, 7)
}

export function normalizeRewardSource(source = {}) {
  const type = ['habit', 'goal', 'milestone', 'flex_group'].includes(source.type) ? source.type : 'habit'
  return {
    id: source.id ?? randomId(),
    type,
    sourceId: source.sourceId ?? source.habitId ?? source.goalId ?? source.milestoneId ?? source.flexibleGroupId ?? null,
  }
}

function legacyRule(reward) {
  const ids = reward.sourceIds?.length ? reward.sourceIds : (reward.sourceId ? [reward.sourceId] : [])
  if (reward.trigger === 'day_sufficient') return { ruleType: 'day_sufficient', period: 'day', threshold: null, sources: [] }
  if (reward.trigger === 'habits_combo') return { ruleType: 'at_least', period: 'day', threshold: reward.targetCount ?? 2, sources: ids.map(sourceId => ({ type: 'habit', sourceId })) }
  if (reward.trigger === 'habit_weekly') return { ruleType: 'at_least', period: 'week', threshold: reward.targetCount ?? 3, sources: ids.map(sourceId => ({ type: 'habit', sourceId })) }
  if (reward.trigger === 'goal_completed') return { ruleType: 'milestone', period: 'once', threshold: null, sources: ids.map(sourceId => ({ type: 'goal', sourceId })) }
  if (reward.trigger === 'milestone_completed') return { ruleType: 'milestone', period: 'once', threshold: null, sources: ids.map(sourceId => ({ type: 'milestone', sourceId })) }
  if (reward.trigger === 'flexible_group') return { ruleType: 'all', period: reward.groupPeriod === 'month' ? 'month' : 'week', threshold: null, sources: ids.map(sourceId => ({ type: 'flex_group', sourceId })) }
  return { ruleType: 'all', period: 'day', threshold: null, sources: ids.map(sourceId => ({ type: 'habit', sourceId })) }
}

function triggerForRule(rule) {
  if (rule.ruleType === 'day_sufficient') return 'day_sufficient'
  if (rule.ruleType === 'milestone') return rule.sources.some(source => source.type === 'milestone') ? 'milestone_completed' : 'goal_completed'
  if (rule.sources.some(source => source.type === 'flex_group')) return 'flexible_group'
  if (rule.period === 'week') return 'habit_weekly'
  if (rule.ruleType === 'at_least' && rule.sources.length > 1) return 'habits_combo'
  return 'habit_daily'
}

export function normalizeReward(reward = {}) {
  const now = new Date().toISOString()
  const rawRule = reward.rule ?? legacyRule(reward)
  const sources = (rawRule.sources ?? []).map(normalizeRewardSource).filter(source => source.sourceId)
  const rule = {
    id: rawRule.id ?? reward.ruleId ?? randomId(),
    ruleType: RULE_TYPES.has(rawRule.ruleType) ? rawRule.ruleType : 'all',
    threshold: rawRule.ruleType === 'at_least' ? Math.max(1, Number(rawRule.threshold) || 1) : null,
    period: PERIODS.has(rawRule.period) ? rawRule.period : 'day',
    activeFrom: rawRule.activeFrom ?? null,
    activeUntil: rawRule.activeUntil ?? null,
    version: Math.max(1, Number(rawRule.version) || 1),
    sources,
  }
  const trigger = triggerForRule(rule)
  return {
    id: reward.id ?? randomId(),
    name: String(reward.name ?? '').trim().slice(0, 120),
    note: String(reward.note ?? reward.description ?? '').trim(),
    safetyNote: String(reward.safetyNote ?? '').trim(),
    status: ['active', 'paused', 'archived'].includes(reward.status)
      ? reward.status
      : reward.enabled === false ? 'paused' : 'active',
    enabled: reward.status ? reward.status === 'active' : reward.enabled !== false,
    version: Math.max(1, Number(reward.version) || 1),
    trigger,
    sourceId: sources[0]?.sourceId ?? null,
    sourceIds: sources.map(source => source.sourceId),
    targetCount: rule.threshold ?? 1,
    rule,
    createdAt: reward.createdAt ?? now,
    updatedAt: reward.updatedAt ?? reward.createdAt ?? now,
    deletedAt: reward.deletedAt ?? null,
  }
}

function builtToday(habit, now) {
  const timezone = habit.schedule?.timezone
  const localDate = localDateKey(now, timezone)
  const day = dayNumberForLocalDate(habit.createdAt, localDate, timezone)
  return BUILD_LEVELS.has(Number(habit.logs?.[day]?.level))
}

function weeklyBuiltCount(habit, now) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return Object.entries(habit.logs ?? {}).filter(([day, log]) => {
    if (!BUILD_LEVELS.has(Number(log.level))) return false
    const date = new Date(habit.createdAt)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + Number(day) - 1)
    return date >= start && date < end
  }).length
}

export function qualifyingCycle(rewardInput, habits = [], goals = [], now = new Date(), context = {}) {
  const reward = normalizeReward(rewardInput)
  if (!reward.enabled || reward.deletedAt) return null
  const { rule } = reward
  const today = dateKey(now)
  if (rule.activeFrom && today < rule.activeFrom) return null
  if (rule.activeUntil && today > rule.activeUntil) return null

  if (rule.ruleType === 'day_sufficient') {
    const sufficient = context.dayClosure?.status === 'sufficient' || context.daySummary?.isSufficient
    return sufficient ? `day:${today}` : null
  }

  if (rule.ruleType === 'milestone') {
    const milestoneSources = rule.sources.filter(source => source.type === 'milestone')
    if (milestoneSources.length) {
      if (milestoneSources.length !== rule.sources.length) return null
      const sourceIds = new Set(milestoneSources.map(source => source.sourceId))
      const completed = (context.milestones ?? []).find(milestone => sourceIds.has(milestone.id) && milestone.status === 'completed' && !milestone.deletedAt)
      return completed ? `milestone:${completed.id}` : null
    }
    const sourceIds = new Set(rule.sources.filter(source => source.type === 'goal').map(source => source.sourceId))
    const completed = goals.find(goal => sourceIds.has(goal.id) && goal.status === 'completed' && !goal.deletedAt)
    return completed ? `goal:${completed.id}` : null
  }

  const groupSources = rule.sources.filter(source => source.type === 'flex_group')
  if (groupSources.length) {
    if (groupSources.length !== rule.sources.length) return null
    const groupsById = new Map((context.flexibleGroups ?? []).map(group => [group.id, group]))
    const groups = groupSources.map(source => groupsById.get(source.sourceId)).filter(Boolean)
    if (groups.length !== groupSources.length) return null
    const progress = groups.map(group => flexibleGroupProgress(group, habits, now))
    if (!progress.every(item => item.isMinimumMet)) return null
    return groups.length === 1
      ? `flex:${groups[0].id}:${progress[0].periodKey}`
      : `flex:${progress.map(item => item.periodKey).join('+')}`
  }

  const habitsById = new Map(habits.map(habit => [habit.id, habit]))
  const sources = rule.sources.map(source => habitsById.get(source.sourceId)).filter(Boolean)
  // A removed source invalidates the agreement until the user edits it. Never
  // lower an all/at-least threshold silently by filtering missing habits.
  if (!sources.length || sources.length !== rule.sources.length) return null

  if (rule.period === 'week') {
    const count = sources.reduce((sum, habit) => sum + weeklyBuiltCount(habit, now), 0)
    const required = rule.ruleType === 'all' ? sources.length : rule.threshold
    return count >= required ? `week:${weekKey(now)}` : null
  }

  const count = sources.filter(habit => builtToday(habit, now)).length
  const required = rule.ruleType === 'all' ? sources.length : rule.threshold
  if (count < required) return null
  if (rule.period === 'month') return `month:${monthKey(now)}`
  return `day:${today}`
}

export function normalizeRewardClaim(claim = {}, reward = null) {
  const unlockedAt = claim.unlockedAt ?? claim.earnedAt ?? new Date().toISOString()
  const usedAt = claim.usedAt ?? claim.redeemedAt ?? null
  return {
    id: claim.id ?? randomId(),
    rewardId: claim.rewardId ?? reward?.id ?? null,
    ruleId: claim.ruleId ?? reward?.rule?.id ?? null,
    rewardName: claim.rewardName ?? reward?.name ?? 'Recompensa',
    rewardNote: claim.rewardNote ?? reward?.note ?? '',
    periodKey: claim.periodKey ?? claim.cycleKey ?? '',
    cycleKey: claim.periodKey ?? claim.cycleKey ?? '',
    unlockedAt,
    earnedAt: unlockedAt,
    claimedAt: claim.claimedAt ?? unlockedAt,
    usedAt,
    redeemedAt: usedAt,
  }
}

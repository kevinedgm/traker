const GOAL_STATUSES = new Set([
  'draft', 'active', 'paused', 'completed', 'reformulated', 'abandoned', 'archived',
])

export const GOAL_HORIZONS = Object.freeze(['short', 'medium', 'long'])
const GOAL_HORIZON_SET = new Set(GOAL_HORIZONS)

export function normalizeGoalHorizon(value) {
  return GOAL_HORIZON_SET.has(value) ? value : 'short'
}

const TRANSITIONS = Object.freeze({
  draft: new Set(['active', 'archived']),
  active: new Set(['paused', 'completed', 'reformulated', 'abandoned', 'archived']),
  paused: new Set(['active', 'reformulated', 'abandoned', 'archived']),
  completed: new Set(['archived']),
  reformulated: new Set(['archived']),
  abandoned: new Set(['archived']),
  archived: new Set(),
})

const ACTION_TRANSITIONS = Object.freeze({
  ready: new Set(['in_progress', 'adapted', 'postponed', 'cancelled']),
  in_progress: new Set(['completed', 'blocked', 'adapted', 'postponed', 'cancelled']),
  blocked: new Set(['ready', 'adapted', 'postponed', 'cancelled']),
  adapted: new Set(['ready', 'in_progress', 'cancelled']),
  postponed: new Set(['ready', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
})

const MILESTONE_STATUSES = new Set(['pending', 'active', 'completed', 'skipped'])

const MILESTONE_TRANSITIONS = Object.freeze({
  pending: new Set(['active', 'completed', 'skipped']),
  active: new Set(['pending', 'completed', 'skipped']),
  completed: new Set(['active']),
  skipped: new Set(['pending', 'active']),
})

export class GoalDomainError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'GoalDomainError'
    this.code = code
  }
}

export function createGoalDraft(input = {}, now = new Date().toISOString()) {
  return {
    id: input.id ?? crypto.randomUUID(),
    userId: input.userId ?? null,
    title: String(input.title ?? '').trim(),
    personalWhy: String(input.personalWhy ?? '').trim(),
    desiredOutcome: String(input.desiredOutcome ?? '').trim(),
    doneDefinition: String(input.doneDefinition ?? '').trim(),
    horizon: normalizeGoalHorizon(input.horizon),
    status: 'draft',
    focusRank: null,
    currentActionId: null,
    reformulatedFromGoalId: input.reformulatedFromGoalId ?? null,
    successorGoalId: input.successorGoalId ?? null,
    closeReason: String(input.closeReason ?? '').trim(),
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    archivedAt: null,
    deletedAt: null,
    version: 1,
  }
}

export function closeGoalConsciously(goal, input = {}, now = new Date().toISOString()) {
  const successorGoalId = input.successorGoalId || null
  if (successorGoalId === goal.id) {
    throw new GoalDomainError('GOAL_CANNOT_SUCCEED_ITSELF', 'La meta sucesora debe ser distinta')
  }
  const closed = transitionGoal(goal, 'abandoned', now)
  return {
    ...closed,
    currentActionId: null,
    closeReason: String(input.closeReason ?? '').trim().slice(0, 500),
    successorGoalId,
  }
}

export function createGoalAction(input = {}, now = new Date().toISOString()) {
  if (!input.goalId) {
    throw new GoalDomainError('ACTION_NOT_OWNED_BY_GOAL', 'An action requires a goal')
  }
  const title = String(input.title ?? '').trim()
  if (!title) {
    throw new GoalDomainError('ACTION_TITLE_REQUIRED', 'An action requires a title')
  }
  return {
    id: input.id ?? crypto.randomUUID(),
    goalId: input.goalId,
    milestoneId: input.milestoneId ?? input.stageId ?? null,
    stageId: input.milestoneId ?? input.stageId ?? null,
    title,
    minimumVersion: String(input.minimumVersion ?? '').trim(),
    energyLevel: input.energyLevel ?? null,
    estimateBucket: input.estimateBucket ?? null,
    status: 'ready',
    positionKey: input.positionKey ?? 'a0',
    blockedReason: null,
    adaptedFromActionId: input.adaptedFromActionId ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

export function createGoalMilestone(input = {}, now = new Date().toISOString()) {
  if (!input.goalId) {
    throw new GoalDomainError('MILESTONE_NOT_OWNED_BY_GOAL', 'A milestone requires a goal')
  }
  const title = String(input.title ?? '').trim()
  if (!title) {
    throw new GoalDomainError('MILESTONE_TITLE_REQUIRED', 'Un hito necesita un nombre')
  }
  return {
    id: input.id ?? crypto.randomUUID(),
    goalId: input.goalId,
    title: title.slice(0, 160),
    doneDefinition: String(input.doneDefinition ?? '').trim(),
    status: MILESTONE_STATUSES.has(input.status) ? input.status : 'pending',
    position: Math.max(0, Number(input.position) || 0),
    targetDate: input.targetDate || null,
    completedAt: input.status === 'completed' ? (input.completedAt ?? now) : null,
    evidenceSummary: String(input.evidenceSummary ?? '').trim(),
    version: Math.max(1, Number(input.version) || 1),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deletedAt: input.deletedAt ?? null,
  }
}

export function updateGoalMilestone(milestone, patch = {}, now = new Date().toISOString()) {
  const title = String(patch.title ?? milestone.title ?? '').trim()
  if (!title) throw new GoalDomainError('MILESTONE_TITLE_REQUIRED', 'Un hito necesita un nombre')
  return {
    ...milestone,
    title: title.slice(0, 160),
    doneDefinition: String(patch.doneDefinition ?? milestone.doneDefinition ?? '').trim(),
    targetDate: patch.targetDate === '' ? null : (patch.targetDate ?? milestone.targetDate ?? null),
    position: Math.max(0, Number(patch.position ?? milestone.position) || 0),
    updatedAt: now,
    version: milestone.version + 1,
  }
}

export function transitionGoalMilestone(milestone, nextStatus, input = {}, now = new Date().toISOString()) {
  if (!MILESTONE_TRANSITIONS[milestone.status]?.has(nextStatus)) {
    throw new GoalDomainError('INVALID_MILESTONE_TRANSITION', `${milestone.status} → ${nextStatus}`)
  }
  const evidenceSummary = String(input.evidenceSummary ?? milestone.evidenceSummary ?? '').trim()
  if (nextStatus === 'completed' && !evidenceSummary) {
    throw new GoalDomainError('MILESTONE_EVIDENCE_REQUIRED', 'Agrega una evidencia breve antes de completar el hito')
  }
  return {
    ...milestone,
    status: nextStatus,
    evidenceSummary,
    completedAt: nextStatus === 'completed' ? now : null,
    updatedAt: now,
    version: milestone.version + 1,
  }
}

export function goalCompletionReadiness(goal, milestones = []) {
  const current = milestones.filter(item => item.goalId === goal.id && !item.deletedAt)
  if (!current.length) return { ready: !goal.currentActionId, total: 0, completed: 0, reason: goal.currentActionId ? 'open_action' : null }
  const required = current.filter(item => item.status !== 'skipped')
  const completed = required.filter(item => item.status === 'completed').length
  const ready = !goal.currentActionId && required.length > 0 && completed === required.length
  return {
    ready,
    total: required.length,
    completed,
    reason: goal.currentActionId ? 'open_action' : required.length === 0 ? 'no_required_milestones' : completed < required.length ? 'pending_milestones' : null,
  }
}

export function transitionGoalAction(action, nextStatus, now = new Date().toISOString()) {
  if (!ACTION_TRANSITIONS[action.status]?.has(nextStatus)) {
    throw new GoalDomainError('INVALID_ACTION_TRANSITION', `${action.status} → ${nextStatus}`)
  }
  return {
    ...action,
    status: nextStatus,
    updatedAt: now,
    version: action.version + 1,
  }
}

export function createWorkSession(input = {}, now = new Date().toISOString()) {
  if (!input.goalId) throw new GoalDomainError('SESSION_GOAL_REQUIRED', 'A session requires a goal')
  return {
    id: input.id ?? crypto.randomUUID(),
    goalId: input.goalId,
    actionId: input.actionId ?? null,
    status: 'running',
    startedAt: now,
    endedAt: null,
    plannedMinutes: input.plannedMinutes ?? null,
    actualSeconds: null,
    outcome: null,
    deviceId: input.deviceId ?? null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
}

export function finishWorkSession(session, outcome, now = new Date().toISOString()) {
  const outcomes = new Set(['partial', 'action_completed', 'blocked', 'stopped_intentionally'])
  if (session.status !== 'running' || !outcomes.has(outcome)) {
    throw new GoalDomainError('INVALID_SESSION_FINISH', `${session.status} → ${outcome}`)
  }
  const actualSeconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(session.startedAt)) / 1000))
  return { ...session, status: 'finished', endedAt: now, actualSeconds, outcome, updatedAt: now, version: session.version + 1 }
}

export function createProgressEntry(input = {}, now = new Date().toISOString()) {
  if (!input.goalId) throw new GoalDomainError('PROGRESS_GOAL_REQUIRED', 'Progress requires a goal')
  return {
    id: input.id ?? crypto.randomUUID(),
    goalId: input.goalId,
    actionId: input.actionId ?? null,
    milestoneId: input.milestoneId ?? null,
    sessionId: input.sessionId ?? null,
    kind: input.kind,
    note: String(input.note ?? '').trim(),
    evidenceText: String(input.evidenceText ?? '').trim(),
    occurredAt: now,
    clientId: input.clientId ?? null,
    createdAt: now,
  }
}

export function canTransitionGoal(from, to) {
  return GOAL_STATUSES.has(from) && GOAL_STATUSES.has(to) && TRANSITIONS[from].has(to)
}

export function transitionGoal(goal, nextStatus, now = new Date().toISOString(), milestones = []) {
  if (!canTransitionGoal(goal.status, nextStatus)) {
    throw new GoalDomainError('INVALID_STATE_TRANSITION', `${goal.status} → ${nextStatus}`)
  }

  if (nextStatus === 'active' && (!goal.title || !goal.doneDefinition)) {
    throw new GoalDomainError('GOAL_ACTIVATION_INCOMPLETE', 'Title and done definition are required')
  }

  if (nextStatus === 'completed') {
    const readiness = goalCompletionReadiness(goal, milestones)
    if (readiness.reason === 'open_action') {
      throw new GoalDomainError('GOAL_HAS_OPEN_ACTION', 'Finish or replace the current action first')
    }
    if (milestones.length && !readiness.ready) {
      throw new GoalDomainError('GOAL_HAS_PENDING_MILESTONES', 'Completa los hitos vigentes antes de cerrar la meta')
    }
  }

  const isClosure = ['completed', 'reformulated', 'abandoned'].includes(nextStatus)
  return {
    ...goal,
    status: nextStatus,
    updatedAt: now,
    closedAt: isClosure ? now : goal.closedAt,
    archivedAt: nextStatus === 'archived' ? now : goal.archivedAt,
    version: goal.version + 1,
  }
}

export function createReformulation(original, input = {}, now = new Date().toISOString()) {
  if (!['active', 'paused'].includes(original.status)) {
    throw new GoalDomainError('GOAL_ALREADY_CLOSED', 'Only active or paused goals can be reformulated')
  }

  const closedGoal = transitionGoal(original, 'reformulated', now)
  const newGoal = createGoalDraft({
    ...input,
    personalWhy: input.personalWhy ?? original.personalWhy,
    horizon: input.horizon ?? original.horizon,
    reformulatedFromGoalId: original.id,
  }, now)

  return { closedGoal, newGoal }
}

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { features } from '@/config/features.js'
import {
  GoalDomainError,
  closeGoalConsciously,
  createGoalAction,
  createGoalDraft,
  createGoalMilestone,
  createProgressEntry,
  createReformulation,
  createWorkSession,
  finishWorkSession,
  goalCompletionReadiness,
  transitionGoalAction,
  transitionGoalMilestone,
  transitionGoal,
  updateGoalMilestone,
} from '@/features/goals/domain.js'
import { createGoalsRepository } from '@/services/local/goals.repository.js'

function disabledError() {
  return new GoalDomainError('GOALS_FEATURE_DISABLED', 'Goals feature is disabled')
}

export function createGoalsStoreDefinition({
  id = 'goals',
  repository = createGoalsRepository(),
  enabled = features.goals,
} = {}) {
  return defineStore(id, () => {
    const goals = ref([])
    const actions = ref([])
    const milestones = ref([])
    const sessions = ref([])
    const progressEntries = ref([])
    const loading = ref(false)
    const loaded = ref(false)
    const error = ref(null)

    const activeGoals = computed(() => goals.value.filter(goal => !goal.deletedAt && goal.status === 'active'))
    const pausedGoals = computed(() => goals.value.filter(goal => !goal.deletedAt && goal.status === 'paused'))
    const closedGoals = computed(() => goals.value.filter(goal =>
      !goal.deletedAt && ['completed', 'reformulated', 'abandoned', 'archived'].includes(goal.status),
    ))
    const focusedGoals = computed(() => activeGoals.value
      .filter(goal => goal.focusRank !== null)
      .sort((a, b) => a.focusRank - b.focusRank))
    const runningSession = computed(() => sessions.value.find(session => session.status === 'running') ?? null)

    function requireEnabled() {
      if (!enabled) throw disabledError()
    }

    function replaceGoal(nextGoal) {
      const index = goals.value.findIndex(goal => goal.id === nextGoal.id)
      if (index === -1) goals.value.push(nextGoal)
      else goals.value[index] = nextGoal
    }

    function replaceAction(nextAction) {
      const index = actions.value.findIndex(action => action.id === nextAction.id)
      if (index === -1) actions.value.push(nextAction)
      else actions.value[index] = nextAction
    }

    function replaceMilestone(nextMilestone) {
      const index = milestones.value.findIndex(milestone => milestone.id === nextMilestone.id)
      if (index === -1) milestones.value.push(nextMilestone)
      else milestones.value[index] = nextMilestone
    }

    function replaceSession(nextSession) {
      const index = sessions.value.findIndex(session => session.id === nextSession.id)
      if (index === -1) sessions.value.push(nextSession)
      else sessions.value[index] = nextSession
    }

    function captureError(cause) {
      error.value = {
        code: cause?.code ?? 'GOALS_UNKNOWN_ERROR',
        message: cause?.message ?? 'No pudimos guardar el cambio.',
      }
    }

    async function run(operation) {
      requireEnabled()
      error.value = null
      try {
        const result = await operation()
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('traker:goals-outbox'))
        return result
      } catch (cause) {
        captureError(cause)
        throw cause
      }
    }

    async function load() {
      requireEnabled()
      loading.value = true
      error.value = null
      try {
        const [savedGoals, savedActions, savedMilestones, savedSessions, savedProgress] = await Promise.all([
          repository.listGoals(),
          repository.listActions(),
          repository.listMilestones(),
          repository.listSessions(),
          repository.listProgress(),
        ])
        goals.value = savedGoals
        actions.value = savedActions
        milestones.value = savedMilestones
        sessions.value = savedSessions
        progressEntries.value = savedProgress
        loaded.value = true
      } catch (cause) {
        captureError(cause)
        throw cause
      } finally {
        loading.value = false
      }
    }

    async function createDraft(input) {
      return run(async () => {
        const goal = createGoalDraft(input)
        await repository.commitGoal(goal, 'create')
        replaceGoal(goal)
        return goal
      })
    }

    async function createGoal(input) {
      return run(async () => {
        const now = new Date().toISOString()
        const original = input.reformulatedFromGoalId
          ? goals.value.find(goal => goal.id === input.reformulatedFromGoalId)
          : null
        if (input.reformulatedFromGoalId && !original) {
          throw new GoalDomainError('GOAL_NOT_FOUND', `Goal not found: ${input.reformulatedFromGoalId}`)
        }
        const reformulation = original ? createReformulation(original, input, now) : null
        const draft = reformulation?.newGoal ?? createGoalDraft(input, now)
        const action = createGoalAction({
          id: input.actionId,
          goalId: draft.id,
          title: input.nextActionTitle,
          minimumVersion: input.minimumVersion,
          energyLevel: input.energyLevel,
          estimateBucket: input.estimateBucket,
        }, now)
        const goal = transitionGoal({ ...draft, currentActionId: action.id }, 'active', now)
        if (reformulation) {
          await repository.commitReformulationWithAction({
            closedGoal: reformulation.closedGoal, newGoal: goal, action,
          })
          replaceGoal(reformulation.closedGoal)
        } else {
          await repository.commitGoalWithAction({ goal, action })
        }
        replaceGoal(goal)
        replaceAction(action)
        return { goal, action }
      })
    }

    async function transition(id, status) {
      return run(async () => {
        const current = goals.value.find(goal => goal.id === id)
        if (!current) throw new GoalDomainError('GOAL_NOT_FOUND', `Goal not found: ${id}`)
        const next = transitionGoal(current, status, new Date().toISOString(), milestonesForGoal(id))
        await repository.commitGoal(next, `transition:${status}`)
        replaceGoal(next)
        return next
      })
    }

    async function closeConsciously(id, input = {}) {
      return run(async () => {
        const current = goals.value.find(goal => goal.id === id)
        if (!current) throw new GoalDomainError('GOAL_NOT_FOUND', `Goal not found: ${id}`)
        const successor = input.successorGoalId
          ? goals.value.find(goal => goal.id === input.successorGoalId && !goal.deletedAt)
          : null
        if (input.successorGoalId && !successor) {
          throw new GoalDomainError('SUCCESSOR_GOAL_NOT_FOUND', 'No encontramos la meta sucesora')
        }
        const next = closeGoalConsciously(current, input)
        await repository.commitGoal(next, 'transition:abandoned')
        replaceGoal(next)
        return next
      })
    }

    async function addMilestone(goalId, input) {
      return run(async () => {
        const goal = goals.value.find(item => item.id === goalId && !item.deletedAt)
        if (!goal || !['active', 'paused', 'draft'].includes(goal.status)) {
          throw new GoalDomainError('GOAL_NOT_EDITABLE', 'Esta meta ya no admite hitos nuevos')
        }
        const current = milestonesForGoal(goalId)
        const milestone = createGoalMilestone({
          ...input,
          goalId,
          position: current.length ? Math.max(...current.map(item => item.position)) + 1 : 0,
        })
        await repository.commitMilestone(milestone, 'create')
        replaceMilestone(milestone)
        return milestone
      })
    }

    async function editMilestone(id, patch) {
      return run(async () => {
        const current = milestones.value.find(item => item.id === id && !item.deletedAt)
        if (!current) throw new GoalDomainError('MILESTONE_NOT_FOUND', `Milestone not found: ${id}`)
        const goal = goals.value.find(item => item.id === current.goalId)
        if (!goal || !['active', 'paused', 'draft'].includes(goal.status)) {
          throw new GoalDomainError('GOAL_NOT_EDITABLE', 'Esta meta ya no admite cambios')
        }
        const milestone = updateGoalMilestone(current, patch)
        await repository.commitMilestone(milestone, 'update')
        replaceMilestone(milestone)
        return milestone
      })
    }

    async function setMilestoneStatus(id, status, input = {}) {
      return run(async () => {
        const current = milestones.value.find(item => item.id === id && !item.deletedAt)
        if (!current) throw new GoalDomainError('MILESTONE_NOT_FOUND', `Milestone not found: ${id}`)
        const goal = goals.value.find(item => item.id === current.goalId)
        if (!goal || !['active', 'paused', 'draft'].includes(goal.status)) {
          throw new GoalDomainError('GOAL_NOT_EDITABLE', 'Esta meta ya no admite cambios')
        }
        const now = new Date().toISOString()
        const milestone = transitionGoalMilestone(current, status, input, now)
        if (status === 'completed') {
          const progress = createProgressEntry({
            goalId: current.goalId,
            milestoneId: current.id,
            kind: 'stage_completed',
            note: current.title,
            evidenceText: milestone.evidenceSummary,
          }, now)
          await repository.completeMilestone({ milestone, progress })
          progressEntries.value.push(progress)
        } else {
          await repository.commitMilestone(milestone, `transition:${status}`)
        }
        replaceMilestone(milestone)
        return milestone
      })
    }

    async function deleteMilestone(id) {
      return run(async () => {
        const current = milestones.value.find(item => item.id === id && !item.deletedAt)
        if (!current) throw new GoalDomainError('MILESTONE_NOT_FOUND', `Milestone not found: ${id}`)
        const now = new Date().toISOString()
        const milestone = { ...current, deletedAt: now, updatedAt: now, version: current.version + 1 }
        await repository.commitMilestone(milestone, 'delete')
        replaceMilestone(milestone)
        return milestone
      })
    }

    async function moveMilestone(id, direction) {
      return run(async () => {
        const current = milestones.value.find(item => item.id === id && !item.deletedAt)
        if (!current) throw new GoalDomainError('MILESTONE_NOT_FOUND', `Milestone not found: ${id}`)
        const ordered = milestonesForGoal(current.goalId)
        const index = ordered.findIndex(item => item.id === id)
        const targetIndex = index + (direction === 'up' ? -1 : 1)
        if (targetIndex < 0 || targetIndex >= ordered.length) return ordered
        const nextOrder = [...ordered]
        ;[nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]]
        const now = new Date().toISOString()
        const changed = nextOrder.map((item, position) => item.position === position ? item : {
          ...item, position, updatedAt: now, version: item.version + 1,
        }).filter(item => item !== ordered.find(original => original.id === item.id))
        await repository.commitMilestones(changed)
        changed.forEach(replaceMilestone)
        return milestonesForGoal(current.goalId)
      })
    }

    async function deleteGoal(id) {
      return run(async () => {
        const current = goals.value.find(goal => goal.id === id && !goal.deletedAt)
        if (!current) throw new GoalDomainError('GOAL_NOT_FOUND', `Goal not found: ${id}`)
        if (runningSession.value?.goalId === id) {
          throw new GoalDomainError('GOAL_SESSION_RUNNING', 'Termina la sesión antes de eliminar esta meta.')
        }
        const now = new Date().toISOString()
        const deleted = {
          ...current,
          focusRank: null,
          currentActionId: null,
          deletedAt: now,
          updatedAt: now,
          version: current.version + 1,
        }
        await repository.commitGoal(deleted, 'delete')
        replaceGoal(deleted)
        return deleted
      })
    }

    async function setNextAction(goalId, input, { adaptCurrent = false } = {}) {
      return run(async () => {
        const currentGoal = goals.value.find(goal => goal.id === goalId)
        if (!currentGoal || currentGoal.status !== 'active') {
          throw new GoalDomainError('GOAL_NOT_ACTIVE', 'La meta debe estar activa para definir un paso')
        }
        const current = actionForGoal(goalId)
        if (current && !adaptCurrent) {
          throw new GoalDomainError('ACTION_ALREADY_SELECTED', 'Esta meta ya tiene una siguiente acción')
        }
        if (adaptCurrent && !current) {
          throw new GoalDomainError('ACTION_NOT_FOUND', 'No hay una acción para adaptar')
        }
        const now = new Date().toISOString()
        const previousAction = adaptCurrent ? transitionGoalAction(current, 'adapted', now) : null
        const action = createGoalAction({
          ...input,
          goalId,
          milestoneId: input.milestoneId ?? null,
          adaptedFromActionId: previousAction?.id ?? null,
          positionKey: `a${actions.value.filter(item => item.goalId === goalId).length}`,
        }, now)
        const goal = { ...currentGoal, currentActionId: action.id, updatedAt: now, version: currentGoal.version + 1 }
        const progress = adaptCurrent ? createProgressEntry({
          goalId, actionId: action.id, kind: 'adjusted',
          note: input.adaptationReason ?? '', evidenceText: previousAction.title,
        }, now) : null
        await repository.setCurrentAction({ goal, action, previousAction, progress })
        replaceGoal(goal)
        if (previousAction) replaceAction(previousAction)
        replaceAction(action)
        if (progress) progressEntries.value.push(progress)
        return { goal, action, previousAction, progress }
      })
    }

    async function setFocus(goalIds) {
      return run(async () => {
        const uniqueIds = [...new Set(goalIds)]
        if (uniqueIds.length !== goalIds.length) {
          throw new GoalDomainError('DUPLICATE_FOCUS_GOAL', 'Una meta no puede ocupar dos posiciones de foco')
        }
        const activeIds = new Set(activeGoals.value.map(goal => goal.id))
        if (uniqueIds.some(id => !activeIds.has(id))) {
          throw new GoalDomainError('FOCUS_GOAL_NOT_ACTIVE', 'Sólo las metas activas pueden estar en foco')
        }
        const rankById = new Map(uniqueIds.map((id, index) => [id, index]))
        const now = new Date().toISOString()
        const changed = goals.value
          .filter(goal => goal.status === 'active')
          .filter(goal => goal.focusRank !== (rankById.get(goal.id) ?? null))
          .map(goal => ({
            ...goal,
            focusRank: rankById.get(goal.id) ?? null,
            updatedAt: now,
            version: goal.version + 1,
          }))
        if (changed.length) {
          await repository.commitGoalFocus(changed)
          changed.forEach(replaceGoal)
        }
        return focusedGoals.value
      })
    }

    async function startAction(goalId) {
      return run(async () => {
        const action = actionForGoal(goalId)
        if (!action) throw new GoalDomainError('ACTION_NOT_FOUND', `Action not found for goal: ${goalId}`)
        if (action.status === 'in_progress') return action
        const next = transitionGoalAction(action, 'in_progress')
        await repository.commitAction(next, 'transition:in_progress')
        replaceAction(next)
        return next
      })
    }

    async function startSession(goalId) {
      return run(async () => {
        if (runningSession.value) {
          if (runningSession.value.goalId === goalId) return runningSession.value
          throw new GoalDomainError('SESSION_ALREADY_RUNNING', 'Ya hay otra sesión en curso')
        }
        const goal = goals.value.find(item => item.id === goalId)
        const current = actionForGoal(goalId)
        if (!goal || goal.status !== 'active' || !current) {
          throw new GoalDomainError('SESSION_NOT_AVAILABLE', 'Esta meta no tiene una acción disponible')
        }
        const now = new Date().toISOString()
        const action = current.status === 'in_progress' ? current : transitionGoalAction(current, 'in_progress', now)
        const session = createWorkSession({ goalId, actionId: action.id }, now)
        const progress = createProgressEntry({ goalId, actionId: action.id, sessionId: session.id, kind: 'started' }, now)
        await repository.startSession({ action, session, progress })
        replaceAction(action)
        replaceSession(session)
        progressEntries.value.push(progress)
        return session
      })
    }

    async function finishSessionCommand(sessionId, outcome, note = '') {
      return run(async () => {
        const currentSession = sessions.value.find(item => item.id === sessionId)
        if (!currentSession) throw new GoalDomainError('SESSION_NOT_FOUND', `Session not found: ${sessionId}`)
        const currentAction = actions.value.find(item => item.id === currentSession.actionId)
        const currentGoal = goals.value.find(item => item.id === currentSession.goalId)
        if (!currentAction || !currentGoal) throw new GoalDomainError('SESSION_CONTEXT_MISSING', 'No encontramos el contexto de esta sesión')
        const now = new Date().toISOString()
        const session = finishWorkSession(currentSession, outcome, now)
        const actionStatus = ({ action_completed: 'completed', blocked: 'blocked' })[outcome]
        const action = actionStatus
          ? transitionGoalAction(currentAction, actionStatus, now)
          : { ...currentAction, updatedAt: now, version: currentAction.version + 1 }
        const goal = outcome === 'action_completed'
          ? { ...currentGoal, currentActionId: null, updatedAt: now, version: currentGoal.version + 1 }
          : null
        const progress = createProgressEntry({
          goalId: currentGoal.id, actionId: currentAction.id, sessionId: session.id,
          kind: outcome === 'stopped_intentionally' ? 'partial' : outcome, note,
        }, now)
        await repository.finishSession({ goal, action, session, progress })
        if (goal) replaceGoal(goal)
        replaceAction(action)
        replaceSession(session)
        progressEntries.value.push(progress)
        return { goal: goal ?? currentGoal, action, session, progress }
      })
    }

    async function reformulate(id, input) {
      return run(async () => {
        const original = goals.value.find(goal => goal.id === id)
        if (!original) throw new GoalDomainError('GOAL_NOT_FOUND', `Goal not found: ${id}`)
        const result = createReformulation(original, input)
        await repository.commitReformulation(result)
        replaceGoal(result.closedGoal)
        replaceGoal(result.newGoal)
        return result
      })
    }

    function clearError() {
      error.value = null
    }

    function clearLocalState() {
      goals.value = []
      actions.value = []
      milestones.value = []
      sessions.value = []
      progressEntries.value = []
      loading.value = false
      loaded.value = true
      error.value = null
    }

    function actionForGoal(goalId) {
      const goal = goals.value.find(item => item.id === goalId)
      return goal?.currentActionId
        ? actions.value.find(action => action.id === goal.currentActionId) ?? null
        : null
    }

    function milestonesForGoal(goalId) {
      return milestones.value
        .filter(item => item.goalId === goalId && !item.deletedAt)
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
    }

    function completionReadiness(goalId) {
      const goal = goals.value.find(item => item.id === goalId)
      return goal ? goalCompletionReadiness(goal, milestonesForGoal(goalId)) : { ready: false, total: 0, completed: 0, reason: 'missing_goal' }
    }

    return {
      goals,
      actions,
      milestones,
      sessions,
      progressEntries,
      loading,
      loaded,
      error,
      isEnabled: enabled,
      activeGoals,
      pausedGoals,
      closedGoals,
      focusedGoals,
      runningSession,
      load,
      createDraft,
      createGoal,
      transition,
      closeConsciously,
      deleteGoal,
      addMilestone,
      editMilestone,
      setMilestoneStatus,
      deleteMilestone,
      moveMilestone,
      setNextAction,
      setFocus,
      startAction,
      startSession,
      finishSession: finishSessionCommand,
      reformulate,
      clearError,
      clearLocalState,
      actionForGoal,
      milestonesForGoal,
      completionReadiness,
    }
  })
}

export const useGoalsStore = createGoalsStoreDefinition()

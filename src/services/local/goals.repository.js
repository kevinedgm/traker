import { GOALS_STORES, openGoalsDatabase } from './goals.database.js'

// IndexedDB cannot structured-clone Vue proxies. Goal records are deliberately
// JSON-shaped, so normalize every value at the persistence boundary.
function cloneForStorage(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

async function put(store, value) {
  return store.put(cloneForStorage(value))
}

function createOperation({ entityType, entityId, operationType, payload, baseVersion = 0, clientId }) {
  return {
    operationId: crypto.randomUUID(),
    clientId,
    entityType,
    entityId,
    operationType,
    baseVersion,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
}

export function createGoalsRepository({ openDatabase = openGoalsDatabase, clientId = crypto.randomUUID() } = {}) {
  async function commitGoal(goal, operationType = 'upsert') {
    const db = await openDatabase()
    const tx = db.transaction([GOALS_STORES.goals, GOALS_STORES.outbox], 'readwrite')
    await put(tx.objectStore(GOALS_STORES.goals), goal)
    const operation = createOperation({
      entityType: 'goal',
      entityId: goal.id,
      operationType,
      payload: goal,
      baseVersion: Math.max(0, goal.version - 1),
      clientId,
    })
    await put(tx.objectStore(GOALS_STORES.outbox), operation)
    await tx.done
    return { goal, operation }
  }

  return {
    async getGoal(id) {
      return (await openDatabase()).get(GOALS_STORES.goals, id)
    },

    async listGoals() {
      return (await openDatabase()).getAll(GOALS_STORES.goals)
    },

    async listActions() {
      return (await openDatabase()).getAll(GOALS_STORES.actions)
    },

    async listMilestones() {
      return (await openDatabase()).getAll(GOALS_STORES.stages)
    },

    async listMilestonesByGoal(goalId) {
      return (await openDatabase()).getAllFromIndex(GOALS_STORES.stages, 'by-goal', goalId)
    },

    async listActionsByGoal(goalId) {
      return (await openDatabase()).getAllFromIndex(GOALS_STORES.actions, 'by-goal', goalId)
    },

    async listSessions() {
      return (await openDatabase()).getAll(GOALS_STORES.sessions)
    },

    async listProgress() {
      return (await openDatabase()).getAll(GOALS_STORES.progress)
    },

    commitGoal,

    async commitAction(action, operationType = 'upsert') {
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.actions, GOALS_STORES.outbox], 'readwrite')
      await put(tx.objectStore(GOALS_STORES.actions), action)
      const operation = createOperation({
        entityType: 'goalAction', entityId: action.id, operationType,
        payload: action, baseVersion: Math.max(0, action.version - 1), clientId,
      })
      await put(tx.objectStore(GOALS_STORES.outbox), operation)
      await tx.done
      return { action, operation }
    },

    async commitMilestone(milestone, operationType = 'upsert') {
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.stages, GOALS_STORES.outbox], 'readwrite')
      await put(tx.objectStore(GOALS_STORES.stages), milestone)
      const operation = createOperation({
        entityType: 'goalMilestone', entityId: milestone.id, operationType,
        payload: milestone, baseVersion: Math.max(0, milestone.version - 1), clientId,
      })
      await put(tx.objectStore(GOALS_STORES.outbox), operation)
      await tx.done
      return { milestone, operation }
    },

    async commitMilestones(milestones, operationType = 'reorder') {
      if (!milestones.length) return milestones
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.stages, GOALS_STORES.outbox], 'readwrite')
      const milestoneStore = tx.objectStore(GOALS_STORES.stages)
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      for (const milestone of milestones) {
        await put(milestoneStore, milestone)
        await put(outbox, createOperation({
          entityType: 'goalMilestone', entityId: milestone.id, operationType,
          payload: milestone, baseVersion: Math.max(0, milestone.version - 1), clientId,
        }))
      }
      await tx.done
      return milestones
    },

    async completeMilestone({ milestone, progress }) {
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.stages, GOALS_STORES.progress, GOALS_STORES.outbox], 'readwrite')
      await put(tx.objectStore(GOALS_STORES.stages), milestone)
      await put(tx.objectStore(GOALS_STORES.progress), progress)
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      for (const [entityType, entity, operationType] of [
        ['goalMilestone', milestone, 'transition:completed'], ['progressEntry', progress, 'create'],
      ]) await put(outbox, createOperation({
        entityType, entityId: entity.id, operationType, payload: entity,
        baseVersion: Math.max(0, (entity.version ?? 1) - 1), clientId,
      }))
      await tx.done
      return { milestone, progress }
    },

    async startSession({ action, session, progress }) {
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.actions, GOALS_STORES.sessions, GOALS_STORES.progress, GOALS_STORES.outbox], 'readwrite')
      await put(tx.objectStore(GOALS_STORES.actions), action)
      await put(tx.objectStore(GOALS_STORES.sessions), session)
      await put(tx.objectStore(GOALS_STORES.progress), progress)
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      for (const [entityType, entity, operationType] of [
        ['goalAction', action, 'transition:in_progress'], ['workSession', session, 'start'], ['progressEntry', progress, 'create'],
      ]) await put(outbox, createOperation({ entityType, entityId: entity.id, operationType, payload: entity, baseVersion: Math.max(0, (entity.version ?? 1) - 1), clientId }))
      await tx.done
      return { action, session, progress }
    },

    async finishSession({ goal, action, session, progress }) {
      const stores = [GOALS_STORES.actions, GOALS_STORES.sessions, GOALS_STORES.progress, GOALS_STORES.outbox]
      if (goal) stores.push(GOALS_STORES.goals)
      const db = await openDatabase()
      const tx = db.transaction(stores, 'readwrite')
      if (goal) await put(tx.objectStore(GOALS_STORES.goals), goal)
      await put(tx.objectStore(GOALS_STORES.actions), action)
      await put(tx.objectStore(GOALS_STORES.sessions), session)
      await put(tx.objectStore(GOALS_STORES.progress), progress)
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      const entities = [...(goal ? [['goal', goal]] : []), ['goalAction', action], ['workSession', session], ['progressEntry', progress]]
      for (const [entityType, entity] of entities) await put(outbox, createOperation({ entityType, entityId: entity.id, operationType: 'finish-session', payload: entity, baseVersion: Math.max(0, (entity.version ?? 1) - 1), clientId }))
      await tx.done
      return { goal, action, session, progress }
    },

    async commitGoalWithAction({ goal, action }) {
      if (goal.id !== action.goalId || goal.currentActionId !== action.id) {
        throw new Error('Goal and current action do not belong to the same aggregate')
      }
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.goals, GOALS_STORES.actions, GOALS_STORES.outbox], 'readwrite')
      await put(tx.objectStore(GOALS_STORES.goals), goal)
      await put(tx.objectStore(GOALS_STORES.actions), action)
      await put(tx.objectStore(GOALS_STORES.outbox), createOperation({
        entityType: 'goal', entityId: goal.id, operationType: 'create',
        payload: goal, baseVersion: 0, clientId,
      }))
      await put(tx.objectStore(GOALS_STORES.outbox), createOperation({
        entityType: 'goalAction', entityId: action.id, operationType: 'create',
        payload: action, baseVersion: 0, clientId,
      }))
      await tx.done
      return { goal, action }
    },

    async setCurrentAction({ goal, action, previousAction = null, progress = null }) {
      if (goal.id !== action.goalId || goal.currentActionId !== action.id) {
        throw new Error('Goal and current action do not belong to the same aggregate')
      }
      const stores = [GOALS_STORES.goals, GOALS_STORES.actions, GOALS_STORES.outbox]
      if (progress) stores.push(GOALS_STORES.progress)
      const db = await openDatabase()
      const tx = db.transaction(stores, 'readwrite')
      await put(tx.objectStore(GOALS_STORES.goals), goal)
      const actionStore = tx.objectStore(GOALS_STORES.actions)
      if (previousAction) await put(actionStore, previousAction)
      await put(actionStore, action)
      if (progress) await put(tx.objectStore(GOALS_STORES.progress), progress)
      const entities = [
        ['goal', goal, 'set-current-action'],
        ...(previousAction ? [['goalAction', previousAction, 'adapt']] : []),
        ['goalAction', action, 'create'],
        ...(progress ? [['progressEntry', progress, 'create']] : []),
      ]
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      for (const [entityType, entity, operationType] of entities) {
        await put(outbox, createOperation({ entityType, entityId: entity.id, operationType, payload: entity, baseVersion: Math.max(0, (entity.version ?? 1) - 1), clientId }))
      }
      await tx.done
      return { goal, action, previousAction, progress }
    },

    async commitGoalFocus(goals) {
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.goals, GOALS_STORES.outbox], 'readwrite')
      const goalStore = tx.objectStore(GOALS_STORES.goals)
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      for (const goal of goals) {
        await put(goalStore, goal)
        await put(outbox, createOperation({
          entityType: 'goal', entityId: goal.id, operationType: 'set-focus',
          payload: goal, baseVersion: Math.max(0, goal.version - 1), clientId,
        }))
      }
      await tx.done
      return goals
    },

    async commitReformulation({ closedGoal, newGoal }) {
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.goals, GOALS_STORES.outbox], 'readwrite')
      const goals = tx.objectStore(GOALS_STORES.goals)
      const outbox = tx.objectStore(GOALS_STORES.outbox)

      await put(goals, closedGoal)
      await put(goals, newGoal)
      await put(outbox, createOperation({
        entityType: 'goal', entityId: closedGoal.id, operationType: 'reformulate-source',
        payload: closedGoal, baseVersion: closedGoal.version - 1, clientId,
      }))
      await put(outbox, createOperation({
        entityType: 'goal', entityId: newGoal.id, operationType: 'reformulate-target',
        payload: newGoal, baseVersion: 0, clientId,
      }))
      await tx.done
      return { closedGoal, newGoal }
    },

    async commitReformulationWithAction({ closedGoal, newGoal, action }) {
      if (newGoal.id !== action.goalId || newGoal.currentActionId !== action.id) {
        throw new Error('Reformulated goal and action do not belong to the same aggregate')
      }
      const db = await openDatabase()
      const tx = db.transaction([GOALS_STORES.goals, GOALS_STORES.actions, GOALS_STORES.outbox], 'readwrite')
      const goals = tx.objectStore(GOALS_STORES.goals)
      const outbox = tx.objectStore(GOALS_STORES.outbox)
      await put(goals, closedGoal)
      await put(goals, newGoal)
      await put(tx.objectStore(GOALS_STORES.actions), action)
      for (const operation of [
        createOperation({ entityType: 'goal', entityId: closedGoal.id, operationType: 'reformulate-source', payload: closedGoal, baseVersion: closedGoal.version - 1, clientId }),
        createOperation({ entityType: 'goal', entityId: newGoal.id, operationType: 'reformulate-target', payload: newGoal, baseVersion: 0, clientId }),
        createOperation({ entityType: 'goalAction', entityId: action.id, operationType: 'create', payload: action, baseVersion: 0, clientId }),
      ]) await put(outbox, operation)
      await tx.done
      return { closedGoal, newGoal, action }
    },

    async listPendingOperations() {
      return (await openDatabase()).getAllFromIndex(GOALS_STORES.outbox, 'by-created-at')
    },

    async acknowledgeOperation(operationId) {
      await (await openDatabase()).delete(GOALS_STORES.outbox, operationId)
    },

    async acknowledgeOperations(operationIds) {
      if (!operationIds.length) return
      const db = await openDatabase()
      const tx = db.transaction(GOALS_STORES.outbox, 'readwrite')
      for (const operationId of operationIds) await tx.store.delete(operationId)
      await tx.done
    },

    async markOperationAttempt(operationId, message = null) {
      const db = await openDatabase()
      const tx = db.transaction(GOALS_STORES.outbox, 'readwrite')
      const operation = await tx.store.get(operationId)
      if (operation) {
        await put(tx.store, {
          ...operation,
          attempts: (operation.attempts ?? 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: message,
        })
      }
      await tx.done
    },

    async getSyncMeta(key) {
      return (await openDatabase()).get(GOALS_STORES.syncMeta, key)
    },

    async setSyncMeta(key, value) {
      const db = await openDatabase()
      await db.put(GOALS_STORES.syncMeta, cloneForStorage({ key, value, updatedAt: new Date().toISOString() }))
    },
  }
}

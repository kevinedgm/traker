import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createGoalsStoreDefinition } from './goals.js'

function createRepository(initial = []) {
  const saved = [...initial]
  return {
    listGoals: vi.fn(async () => saved),
    listActions: vi.fn(async () => []),
    listMilestones: vi.fn(async () => []),
    listSessions: vi.fn(async () => []),
    listProgress: vi.fn(async () => []),
    commitGoal: vi.fn(async goal => ({ goal })),
    commitAction: vi.fn(async action => ({ action })),
    commitMilestone: vi.fn(async milestone => ({ milestone })),
    commitMilestones: vi.fn(async milestones => milestones),
    completeMilestone: vi.fn(async result => result),
    commitGoalWithAction: vi.fn(async result => result),
    setCurrentAction: vi.fn(async result => result),
    commitGoalFocus: vi.fn(async goals => goals),
    commitReformulationWithAction: vi.fn(async result => result),
    startSession: vi.fn(async result => result),
    finishSession: vi.fn(async result => result),
    commitReformulation: vi.fn(async result => result),
  }
}

describe('goals store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('does not initialise storage while the feature is disabled', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-disabled', repository, enabled: false })
    const store = useStore()

    await expect(store.load()).rejects.toMatchObject({ code: 'GOALS_FEATURE_DISABLED' })
    expect(repository.listGoals).not.toHaveBeenCalled()
  })

  it('creates an active goal with its first actionable step', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-create', repository, enabled: true })
    const store = useStore()

    const { goal, action } = await store.createGoal({
      id: 'goal-1', actionId: 'action-1', title: 'Cerrar propuesta',
      doneDefinition: 'Propuesta enviada', nextActionTitle: 'Abrir el documento',
    })
    await store.startAction(goal.id)

    expect(goal).toMatchObject({ status: 'active', currentActionId: 'action-1' })
    expect(action.status).toBe('ready')
    expect(store.actionForGoal(goal.id).status).toBe('in_progress')
    expect(repository.commitGoalWithAction).toHaveBeenCalledOnce()
    expect(repository.commitAction).toHaveBeenCalledOnce()
  })

  it('starts and finishes a partial work session without losing the current action', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-session', repository, enabled: true })
    const store = useStore()
    const { goal, action } = await store.createGoal({
      id: 'goal-session', actionId: 'action-session', title: 'Preparar resumen',
      doneDefinition: 'Resumen enviado', nextActionTitle: 'Escribir tres ideas',
    })

    const session = await store.startSession(goal.id)
    const result = await store.finishSession(session.id, 'partial', 'Retomar desde la segunda idea')

    expect(store.runningSession).toBeNull()
    expect(result.session.outcome).toBe('partial')
    expect(result.progress.note).toBe('Retomar desde la segunda idea')
    expect(store.actionForGoal(goal.id).id).toBe(action.id)
    expect(repository.startSession).toHaveBeenCalledOnce()
    expect(repository.finishSession).toHaveBeenCalledOnce()
  })

  it('adapts a blocked action with a linked replacement', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-adapt', repository, enabled: true })
    const store = useStore()
    const { goal } = await store.createGoal({
      id: 'goal-adapt', actionId: 'action-old', title: 'Enviar solicitud',
      doneDefinition: 'Solicitud aceptada', nextActionTitle: 'Completar todo el formulario',
    })
    const session = await store.startSession(goal.id)
    await store.finishSession(session.id, 'blocked', 'Faltan documentos')

    const result = await store.setNextAction(goal.id, {
      id: 'action-new', title: 'Buscar la lista de documentos', minimumVersion: 'Abrir la convocatoria',
    }, { adaptCurrent: true })

    expect(result.previousAction).toMatchObject({ id: 'action-old', status: 'adapted' })
    expect(result.action).toMatchObject({ id: 'action-new', status: 'ready', adaptedFromActionId: 'action-old' })
    expect(store.actionForGoal(goal.id).id).toBe('action-new')
    expect(repository.setCurrentAction).toHaveBeenCalledOnce()
  })

  it('completes a goal only after its current action is finished', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-complete', repository, enabled: true })
    const store = useStore()
    const { goal } = await store.createGoal({
      id: 'goal-complete', actionId: 'action-complete', title: 'Enviar resumen',
      doneDefinition: 'Resumen enviado', nextActionTitle: 'Enviar correo',
    })
    const session = await store.startSession(goal.id)
    await store.finishSession(session.id, 'action_completed')
    const completed = await store.transition(goal.id, 'completed')

    expect(completed.status).toBe('completed')
    expect(completed.closedAt).toBeTruthy()
  })

  it('requires milestone evidence and closes a goal only after every current milestone', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-milestones', repository, enabled: true })
    const store = useStore()
    const { goal } = await store.createGoal({
      id: 'goal-milestones', actionId: 'action-milestones', title: 'Publicar guía',
      doneDefinition: 'Guía publicada', nextActionTitle: 'Preparar estructura',
    })
    const first = await store.addMilestone(goal.id, { id: 'm1', title: 'Validar estructura', doneDefinition: 'Aprobada por revisión' })
    await store.addMilestone(goal.id, { id: 'm2', title: 'Publicar versión final' })
    const session = await store.startSession(goal.id)
    await store.finishSession(session.id, 'action_completed')

    await expect(store.transition(goal.id, 'completed')).rejects.toMatchObject({ code: 'GOAL_HAS_PENDING_MILESTONES' })
    await expect(store.setMilestoneStatus(first.id, 'completed')).rejects.toMatchObject({ code: 'MILESTONE_EVIDENCE_REQUIRED' })
    await store.setMilestoneStatus('m1', 'completed', { evidenceSummary: 'Revisión aprobada' })
    await store.setMilestoneStatus('m2', 'completed', { evidenceSummary: 'URL publicada' })
    const completed = await store.transition(goal.id, 'completed')

    expect(completed.status).toBe('completed')
    expect(store.completionReadiness(goal.id)).toMatchObject({ ready: true, total: 2, completed: 2 })
    expect(store.progressEntries.at(-1)).toMatchObject({ kind: 'stage_completed', evidenceText: 'URL publicada' })
    expect(repository.completeMilestone).toHaveBeenCalledTimes(2)
  })

  it('reorders and soft-deletes milestones without losing their goal link', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-milestone-order', repository, enabled: true })
    const store = useStore()
    const { goal } = await store.createGoal({ id: 'g-order', actionId: 'a-order', title: 'Ordenar', doneDefinition: 'Listo', nextActionTitle: 'Empezar' })
    await store.addMilestone(goal.id, { id: 'm1', title: 'Primero' })
    await store.addMilestone(goal.id, { id: 'm2', title: 'Segundo' })

    await store.moveMilestone('m2', 'up')
    await store.deleteMilestone('m1')

    expect(store.milestonesForGoal(goal.id).map(item => item.id)).toEqual(['m2'])
    expect(store.milestones.find(item => item.id === 'm1').deletedAt).toBeTruthy()
    expect(repository.commitMilestones).toHaveBeenCalledOnce()
  })

  it('persists an ordered focus shortlist without closing other goals', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-focus', repository, enabled: true })
    const store = useStore()
    await store.createGoal({ id: 'g1', actionId: 'a1', title: 'Primera', doneDefinition: 'Lista', nextActionTitle: 'Paso 1' })
    await store.createGoal({ id: 'g2', actionId: 'a2', title: 'Segunda', doneDefinition: 'Lista', nextActionTitle: 'Paso 2' })

    await store.setFocus(['g2', 'g1'])

    expect(store.focusedGoals.map(goal => goal.id)).toEqual(['g2', 'g1'])
    expect(store.activeGoals).toHaveLength(2)
    expect(repository.commitGoalFocus).toHaveBeenCalledOnce()
  })

  it('soft-deletes a goal and removes it from every visible collection', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-delete', repository, enabled: true })
    const store = useStore()
    const { goal } = await store.createGoal({
      id: 'goal-delete', actionId: 'action-delete', title: 'Meta temporal',
      doneDefinition: 'Ya no es necesaria', nextActionTitle: 'Primer paso',
    })

    const deleted = await store.deleteGoal(goal.id)

    expect(deleted.deletedAt).toBeTruthy()
    expect(deleted.currentActionId).toBeNull()
    expect(store.activeGoals).toHaveLength(0)
    expect(store.closedGoals).toHaveLength(0)
    expect(repository.commitGoal).toHaveBeenLastCalledWith(expect.objectContaining({ id: goal.id }), 'delete')
  })

  it('loads, creates and transitions goals through the repository', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-enabled', repository, enabled: true })
    const store = useStore()

    await store.load()
    const draft = await store.createDraft({
      id: 'goal-1', title: 'Preparar informe', doneDefinition: 'Informe enviado',
    })
    const active = await store.transition(draft.id, 'active')

    expect(store.loaded).toBe(true)
    expect(active.status).toBe('active')
    expect(store.activeGoals).toHaveLength(1)
    expect(repository.commitGoal).toHaveBeenCalledTimes(2)
  })

  it('stores both sides of a reformulation in memory after commit', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-reformulate', repository, enabled: true })
    const store = useStore()

    const draft = await store.createDraft({
      id: 'old', title: 'Preparar informe', doneDefinition: 'Informe enviado',
    })
    await store.transition(draft.id, 'active')
    await store.reformulate(draft.id, { id: 'new', title: 'Preparar resumen' })

    expect(store.goals.find(goal => goal.id === 'old').status).toBe('reformulated')
    expect(store.goals.find(goal => goal.id === 'new').reformulatedFromGoalId).toBe('old')
    expect(repository.commitReformulation).toHaveBeenCalledOnce()
  })

  it('closes an active goal consciously without discarding its action history', async () => {
    const repository = createRepository()
    const useStore = createGoalsStoreDefinition({ id: 'goals-conscious-close', repository, enabled: true })
    const store = useStore()
    const { goal, action } = await store.createGoal({
      id: 'close-source', actionId: 'close-action', title: 'Curso largo',
      doneDefinition: 'Curso publicado', nextActionTitle: 'Terminar el temario',
    })
    const { goal: successor } = await store.createGoal({
      id: 'close-successor', actionId: 'successor-action', title: 'Taller breve',
      doneDefinition: 'Taller impartido', nextActionTitle: 'Elegir fecha',
    })

    const closed = await store.closeConsciously(goal.id, {
      closeReason: 'Prefiero una versión más pequeña',
      successorGoalId: successor.id,
    })

    expect(closed).toMatchObject({
      status: 'abandoned', currentActionId: null,
      closeReason: 'Prefiero una versión más pequeña', successorGoalId: successor.id,
    })
    expect(store.actions.find(item => item.id === action.id)).toEqual(action)
    expect(repository.commitGoal).toHaveBeenLastCalledWith(expect.objectContaining({ id: goal.id }), 'transition:abandoned')
  })
})

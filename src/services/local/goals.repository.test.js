import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createGoalAction, createGoalDraft, createGoalMilestone, createProgressEntry, createReformulation, transitionGoal, transitionGoalMilestone } from '@/features/goals/domain.js'
import { deleteGoalsDatabase, openGoalsDatabase, readGoalsStores, GOALS_STORES } from './goals.database.js'
import { createGoalsRepository } from './goals.repository.js'

const DB_NAME = 'traker-goals-test'

describe('goals repository', () => {
  let repository

  beforeEach(async () => {
    await deleteGoalsDatabase(DB_NAME)
    repository = createGoalsRepository({
      clientId: 'test-client',
      openDatabase: () => openGoalsDatabase({ name: DB_NAME }),
    })
  })

  afterEach(() => deleteGoalsDatabase(DB_NAME))

  it('commits a goal and its outbox operation atomically', async () => {
    const goal = createGoalDraft({ id: 'goal-1', title: 'Preparar informe' })
    await repository.commitGoal(goal)

    expect(await repository.getGoal(goal.id)).toEqual(goal)
    expect(await repository.listPendingOperations()).toMatchObject([
      { clientId: 'test-client', entityId: 'goal-1', operationType: 'upsert' },
    ])
    const exported = await readGoalsStores({ name: DB_NAME })
    expect(exported[GOALS_STORES.goals]).toEqual([goal])
    expect(exported[GOALS_STORES.outbox]).toHaveLength(1)
  })

  it('removes Vue proxies at the IndexedDB boundary', async () => {
    const goal = reactive(createGoalDraft({ id: 'goal-proxy', title: 'Meta reactiva' }))

    await expect(repository.commitGoal(goal)).resolves.toBeTruthy()
    expect(await repository.getGoal(goal.id)).toMatchObject({ id: 'goal-proxy', title: 'Meta reactiva' })
  })

  it('stores both sides of a linked reformulation', async () => {
    const original = transitionGoal(createGoalDraft({
      id: 'old', title: 'Preparar informe', doneDefinition: 'Informe enviado',
    }), 'active')
    await repository.commitGoal(original)

    const reformulation = createReformulation(original, { id: 'new', title: 'Preparar resumen' })
    await repository.commitReformulation(reformulation)

    expect(await repository.getGoal('old')).toMatchObject({ status: 'reformulated' })
    expect(await repository.getGoal('new')).toMatchObject({ reformulatedFromGoalId: 'old' })
    expect(await repository.listPendingOperations()).toHaveLength(3)
  })

  it('commits a new goal and its first action as one aggregate', async () => {
    const draft = createGoalDraft({ id: 'goal-2', title: 'Ordenar estudio', doneDefinition: 'Mesa despejada' })
    const action = createGoalAction({ id: 'action-2', goalId: draft.id, title: 'Guardar tres papeles' })
    const goal = transitionGoal({ ...draft, currentActionId: action.id }, 'active')

    await repository.commitGoalWithAction({ goal, action })

    expect(await repository.getGoal(goal.id)).toEqual(goal)
    expect(await repository.listActionsByGoal(goal.id)).toEqual([action])
    expect(await repository.listPendingOperations()).toHaveLength(2)
  })

  it('replaces the current action while preserving the adapted action', async () => {
    const draft = createGoalDraft({ id: 'goal-3', title: 'Enviar solicitud', doneDefinition: 'Solicitud enviada' })
    const previous = createGoalAction({ id: 'action-old', goalId: draft.id, title: 'Completar formulario' })
    const active = transitionGoal({ ...draft, currentActionId: previous.id }, 'active')
    await repository.commitGoalWithAction({ goal: active, action: previous })
    const adapted = { ...previous, status: 'adapted', version: 2 }
    const action = createGoalAction({ id: 'action-new', goalId: active.id, title: 'Buscar documentos', adaptedFromActionId: previous.id })
    const goal = { ...active, currentActionId: action.id, version: active.version + 1 }

    await repository.setCurrentAction({ goal, action, previousAction: adapted })

    expect(await repository.getGoal(goal.id)).toMatchObject({ currentActionId: 'action-new' })
    expect(await repository.listActionsByGoal(goal.id)).toEqual(expect.arrayContaining([adapted, action]))
  })

  it('stores milestone completion, evidence and outbox operations atomically', async () => {
    const pending = createGoalMilestone({ id: 'milestone-1', goalId: 'goal-1', title: 'Validar' })
    await repository.commitMilestone(pending, 'create')
    const completed = transitionGoalMilestone(pending, 'completed', { evidenceSummary: 'Aprobación recibida' })
    const progress = createProgressEntry({
      id: 'progress-milestone', goalId: 'goal-1', milestoneId: pending.id,
      kind: 'stage_completed', note: pending.title, evidenceText: completed.evidenceSummary,
    })

    await repository.completeMilestone({ milestone: completed, progress })

    expect(await repository.listMilestonesByGoal('goal-1')).toEqual([completed])
    expect((await repository.listProgress()).at(-1)).toEqual(progress)
    expect(await repository.listPendingOperations()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'goalMilestone', entityId: 'milestone-1' }),
      expect.objectContaining({ entityType: 'progressEntry', entityId: 'progress-milestone' }),
    ]))
  })
})

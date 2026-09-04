import { describe, expect, it } from 'vitest'
import {
  GoalDomainError,
  canTransitionGoal,
  closeGoalConsciously,
  createGoalAction,
  createGoalDraft,
  createGoalMilestone,
  createProgressEntry,
  createReformulation,
  createWorkSession,
  finishWorkSession,
  transitionGoal,
  transitionGoalAction,
  transitionGoalMilestone,
} from './domain.js'

const NOW = '2026-08-25T12:00:00.000Z'

describe('goals domain', () => {
  it('creates a stable draft contract', () => {
    const goal = createGoalDraft({ id: 'goal-1', title: '  Entregar tesis  ' }, NOW)
    expect(goal).toMatchObject({ id: 'goal-1', title: 'Entregar tesis', horizon: 'short', status: 'draft', version: 1 })
  })

  it('keeps a valid horizon and safely defaults unknown values', () => {
    expect(createGoalDraft({ horizon: 'long' }, NOW).horizon).toBe('long')
    expect(createGoalDraft({ horizon: 'someday' }, NOW).horizon).toBe('short')
  })

  it('requires a title and done definition before activation', () => {
    const goal = createGoalDraft({ id: 'goal-1', title: 'Tesis' }, NOW)
    expect(() => transitionGoal(goal, 'active', NOW)).toThrowError(GoalDomainError)
  })

  it('does not allow a closed goal to become active', () => {
    expect(canTransitionGoal('completed', 'active')).toBe(false)
  })

  it('does not complete a goal while it still has an open action', () => {
    const draft = createGoalDraft({ id: 'goal-1', title: 'Tesis', doneDefinition: 'Documento aceptado' }, NOW)
    const active = transitionGoal({ ...draft, currentActionId: 'action-1' }, 'active', NOW)
    expect(() => transitionGoal(active, 'completed', NOW)).toThrowError(GoalDomainError)
  })

  it('starts a ready action without losing its goal link', () => {
    const action = createGoalAction({ id: 'action-1', goalId: 'goal-1', title: 'Abrir documento' }, NOW)
    const started = transitionGoalAction(action, 'in_progress', NOW)
    expect(started).toMatchObject({ id: 'action-1', goalId: 'goal-1', status: 'in_progress', version: 2 })
  })

  it('completes a milestone only with observable evidence', () => {
    const milestone = createGoalMilestone({ id: 'm1', goalId: 'goal-1', title: 'Validar borrador' }, NOW)

    expect(() => transitionGoalMilestone(milestone, 'completed', {}, NOW)).toThrowError(GoalDomainError)
    expect(transitionGoalMilestone(milestone, 'completed', { evidenceSummary: 'Aprobado por Ana' }, NOW)).toMatchObject({
      status: 'completed', evidenceSummary: 'Aprobado por Ana', completedAt: NOW, version: 2,
    })
  })

  it('finishes a persisted session and records elapsed seconds', () => {
    const session = createWorkSession({ id: 'session-1', goalId: 'goal-1', actionId: 'action-1' }, NOW)
    const finished = finishWorkSession(session, 'partial', '2026-08-25T12:02:30.000Z')
    const progress = createProgressEntry({ goalId: 'goal-1', sessionId: session.id, kind: 'partial' }, NOW)
    expect(finished).toMatchObject({ status: 'finished', outcome: 'partial', actualSeconds: 150 })
    expect(progress).toMatchObject({ goalId: 'goal-1', sessionId: 'session-1', kind: 'partial' })
  })

  it('reformulates by closing the original and linking a new draft', () => {
    const draft = createGoalDraft({ id: 'old', title: 'Tesis', doneDefinition: 'Documento aceptado', horizon: 'medium' }, NOW)
    const active = transitionGoal(draft, 'active', NOW)
    const { closedGoal, newGoal } = createReformulation(active, { id: 'new', title: 'Entregar capítulo' }, NOW)

    expect(closedGoal.status).toBe('reformulated')
    expect(newGoal).toMatchObject({ id: 'new', horizon: 'medium', status: 'draft', reformulatedFromGoalId: 'old' })
  })

  it('closes consciously while preserving a reason and optional successor', () => {
    const draft = createGoalDraft({ id: 'old', title: 'Curso largo', doneDefinition: 'Curso publicado' }, NOW)
    const active = transitionGoal({ ...draft, currentActionId: 'action-1' }, 'active', NOW)
    const closed = closeGoalConsciously(active, {
      closeReason: 'Ya no corresponde a la dirección actual',
      successorGoalId: 'new',
    }, NOW)

    expect(closed).toMatchObject({
      status: 'abandoned',
      currentActionId: null,
      closeReason: 'Ya no corresponde a la dirección actual',
      successorGoalId: 'new',
      closedAt: NOW,
      version: 3,
    })
  })
})

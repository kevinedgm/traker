begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

select has_function(
  'public',
  'sync_traker_goal_milestone_operations',
  array['jsonb'],
  'goal milestone sync RPC exists'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.sync_traker_goal_milestone_operations(jsonb)'::regprocedure),
  'goal milestone sync runs as security invoker'
);

select ok(
  has_function_privilege('authenticated', 'public.sync_traker_goal_milestone_operations(jsonb)', 'execute'),
  'authenticated clients can execute goal milestone sync'
);

select ok(
  not has_function_privilege('anon', 'public.sync_traker_goal_milestone_operations(jsonb)', 'execute'),
  'anonymous clients cannot execute goal milestone sync'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.traker_goal_milestones'::regclass),
  'goal milestones keep row level security enabled'
);

insert into auth.users (id, email)
values ('33333333-3333-4333-8333-333333333333', 'milestones@traker.local');

set local role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-4333-8333-333333333333';

insert into public.traker_product_consents (
  user_id, purpose, consent_version, granted_at
) values (
  '33333333-3333-4333-8333-333333333333',
  'goals_sync',
  'test-v1',
  '2026-08-31T14:00:00Z'
);

insert into public.traker_goals (
  id, user_id, title, done_definition, status, horizon
) values (
  '33333333-0000-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333333',
  'Publicar guía',
  'Guía disponible',
  'active',
  'short'
);

select is(
  public.sync_traker_goal_milestone_operations($json$[
    {
      "operationId": "33333333-1000-4333-8333-333333333333",
      "entityType": "goalMilestone",
      "entityId": "33333333-2000-4333-8333-333333333333",
      "operationType": "create",
      "baseVersion": 0,
      "payload": {
        "goalId": "33333333-0000-4333-8333-333333333333",
        "title": "Validar borrador",
        "doneDefinition": "Revisión aprobada",
        "status": "completed",
        "position": 0,
        "targetDate": "2026-09-01",
        "completedAt": "2026-08-31T14:15:00Z",
        "evidenceSummary": "Aprobación recibida",
        "version": 1,
        "createdAt": "2026-08-31T14:00:00Z",
        "updatedAt": "2026-08-31T14:15:00Z",
        "deletedAt": null
      }
    }
  ]$json$::jsonb)->'results'->0->>'status',
  'applied',
  'a valid milestone operation is applied'
);

select is(
  (select evidence_summary from public.traker_goal_milestones where id = '33333333-2000-4333-8333-333333333333'),
  'Aprobación recibida',
  'milestone evidence is persisted'
);

select is(
  public.sync_traker_goal_milestone_operations($json$[
    {
      "operationId": "33333333-1000-4333-8333-333333333333",
      "entityType": "goalMilestone",
      "entityId": "33333333-2000-4333-8333-333333333333",
      "operationType": "create",
      "baseVersion": 0,
      "payload": {}
    }
  ]$json$::jsonb)->'results'->0->>'status',
  'duplicate',
  'replayed milestone operations are idempotent'
);

select is(
  public.sync_traker_goal_milestone_operations($json$[
    {
      "operationId": "33333333-1001-4333-8333-333333333333",
      "entityType": "goalMilestone",
      "entityId": "33333333-2000-4333-8333-333333333333",
      "operationType": "update",
      "baseVersion": 0,
      "payload": {
        "goalId": "33333333-0000-4333-8333-333333333333",
        "title": "Intento obsoleto",
        "status": "active",
        "position": 0,
        "version": 2,
        "createdAt": "2026-08-31T14:00:00Z",
        "updatedAt": "2026-08-31T14:20:00Z"
      }
    }
  ]$json$::jsonb)->'results'->0->>'status',
  'conflict',
  'stale milestone versions are rejected as conflicts'
);

select * from finish();
rollback;

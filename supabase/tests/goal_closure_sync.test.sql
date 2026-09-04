begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

select has_column('public', 'settings', 'daily_checkin_prompt', 'daily check-in preference is stored in account settings');
select has_function('public', 'sync_traker_goal_operations', array['jsonb'], 'goal sync wrapper exists');
select ok(
  not (select prosecdef from pg_proc where oid = 'public.sync_traker_goal_operations(jsonb)'::regprocedure),
  'goal sync wrapper runs as security invoker'
);
select ok(
  has_function_privilege('authenticated', 'public.sync_traker_goal_operations(jsonb)', 'execute'),
  'authenticated clients can execute goal sync'
);
select ok(
  not has_function_privilege('anon', 'public.sync_traker_goal_operations(jsonb)', 'execute'),
  'anonymous clients cannot execute goal sync'
);

insert into auth.users (id, email)
values ('44444444-4444-4444-8444-444444444444', 'closure@traker.local');

set local role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-8444-444444444444';

insert into public.traker_product_consents (
  user_id, purpose, consent_version, granted_at
) values (
  '44444444-4444-4444-8444-444444444444',
  'goals_sync',
  'test-v1',
  '2026-09-01T06:00:00Z'
);

select is(
  public.sync_traker_goal_operations($json$[
    {
      "operationId": "44444444-1000-4444-8444-444444444444",
      "entityType": "goal",
      "entityId": "44444444-2000-4444-8444-444444444444",
      "operationType": "transition:abandoned",
      "baseVersion": 0,
      "payload": {
        "title": "Curso anterior",
        "personalWhy": "",
        "desiredOutcome": "",
        "doneDefinition": "Curso publicado",
        "horizon": "short",
        "status": "abandoned",
        "focusRank": null,
        "currentActionId": null,
        "reformulatedFromGoalId": null,
        "closeReason": "Prefiero una versión más pequeña",
        "successorGoalId": "44444444-3000-4444-8444-444444444444",
        "closedAt": "2026-09-01T06:05:00Z",
        "archivedAt": null,
        "deletedAt": null,
        "version": 1,
        "createdAt": "2026-09-01T06:00:00Z",
        "updatedAt": "2026-09-01T06:05:00Z"
      }
    },
    {
      "operationId": "44444444-1001-4444-8444-444444444444",
      "entityType": "goal",
      "entityId": "44444444-3000-4444-8444-444444444444",
      "operationType": "create",
      "baseVersion": 0,
      "payload": {
        "title": "Taller breve",
        "personalWhy": "",
        "desiredOutcome": "",
        "doneDefinition": "Taller impartido",
        "horizon": "medium",
        "status": "active",
        "focusRank": null,
        "currentActionId": null,
        "reformulatedFromGoalId": null,
        "closeReason": "",
        "successorGoalId": null,
        "closedAt": null,
        "archivedAt": null,
        "deletedAt": null,
        "version": 1,
        "createdAt": "2026-09-01T06:00:00Z",
        "updatedAt": "2026-09-01T06:00:00Z"
      }
    }
  ]$json$::jsonb)->'results'->0->>'status',
  'applied',
  'conscious closure operation is applied'
);

select is(
  (select close_reason from public.traker_goals where id = '44444444-2000-4444-8444-444444444444'),
  'Prefiero una versión más pequeña',
  'conscious closure reason survives sync'
);

select is(
  (select successor_goal_id::text from public.traker_goals where id = '44444444-2000-4444-8444-444444444444'),
  '44444444-3000-4444-8444-444444444444',
  'optional successor survives sync'
);

select * from finish();
rollback;

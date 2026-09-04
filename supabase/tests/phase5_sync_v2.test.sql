begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

select has_column('public', 'traker_habit_logs', 'migration_quality', 'logs expose migration quality');
select has_column('public', 'traker_habit_logs', 'legacy_day_number', 'logs preserve legacy day numbers');
select has_column('public', 'traker_habit_schedules', 'migration_quality', 'schedules expose migration quality');
select has_function('public', 'traker_apply_sync_operations', array['text', 'jsonb'], 'v2 push RPC exists');
select has_function(
  'public',
  'traker_pull_sync_changes',
  array['text', 'timestamp with time zone', 'uuid', 'integer'],
  'v2 pull RPC exists'
);
select hasnt_function('public', 'traker_backfill_quality', array[]::text[], 'legacy quality report is retired');
select hasnt_function('public', 'traker_backfill_legacy', array['uuid'], 'legacy backfill is retired');
select ok(
  to_regclass('public.habit_entries') is null,
  'legacy habit entries table is retired'
);
select ok(
  to_regnamespace('traker_phase6_rollback') is null,
  'the authorized Phase 6 rollback archive is retired'
);
select ok(
  has_function_privilege('authenticated', 'public.traker_apply_sync_operations(text,jsonb)', 'execute'),
  'authenticated users can call the push RPC'
);
select ok(
  not has_function_privilege('anon', 'public.traker_apply_sync_operations(text,jsonb)', 'execute'),
  'anonymous users cannot call the push RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.traker_sync_operations', 'insert'),
  'clients cannot bypass the sync RPC to insert ledger rows'
);

insert into auth.users (id, email)
values
  ('51111111-1111-4111-8111-111111111111', 'phase5-a@traker.local'),
  ('52222222-2222-4222-8222-222222222222', 'phase5-b@traker.local');

set local role authenticated;
set local "request.jwt.claim.sub" = '51111111-1111-4111-8111-111111111111';

insert into public.habits (
  id, user_id, title, total_days, reminder_time, timezone, version
) values (
  '5a000000-0000-4000-8000-000000000001',
  '51111111-1111-4111-8111-111111111111',
  'Leer',
  30,
  '08:30',
  'America/Mexico_City',
  1
);

reset role;
set local "request.jwt.claim.sub" = '';
insert into public.habits (id, user_id, title, total_days, version)
values (
  '5a000000-0000-4000-8000-000000000002',
  '52222222-2222-4222-8222-222222222222',
  'Privado B',
  30,
  1
);
set local role authenticated;
set local "request.jwt.claim.sub" = '51111111-1111-4111-8111-111111111111';

select is(
  public.traker_apply_sync_operations(
    'device-a',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000010',
      'entityType', 'habit',
      'entityId', '5a000000-0000-4000-8000-000000000002',
      'operationType', 'upsert',
      'baseVersion', 1,
      'occurredAt', now(),
      'payload', jsonb_build_object('name', 'Intento cruzado')
    ))
  )->0->>'result',
  'conflict',
  'the security-definer push RPC cannot resolve another user entity'
);

reset role;
set local "request.jwt.claim.sub" = '';
select is(
  (select title from public.habits where id = '5a000000-0000-4000-8000-000000000002'),
  'Privado B',
  'the cross-user RPC attempt leaves the other user row unchanged'
);
set local role authenticated;
set local "request.jwt.claim.sub" = '51111111-1111-4111-8111-111111111111';

select is(
  public.traker_apply_sync_operations(
    'device-a',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000001',
      'entityType', 'habit',
      'entityId', '5a000000-0000-4000-8000-000000000001',
      'operationType', 'upsert',
      'baseVersion', 1,
      'occurredAt', now(),
      'payload', jsonb_build_object('name', 'Leer 20 minutos', 'lifecycleStatus', 'paused', 'isActive', false)
    ))
  )->0->>'result',
  'applied',
  'device A can update habit metadata and pause it'
);
select is(
  (select version from public.habits where id = '5a000000-0000-4000-8000-000000000001'),
  2,
  'the accepted mutation increments the server version'
);
select is(
  public.traker_apply_sync_operations(
    'device-b',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000002',
      'entityType', 'habit',
      'entityId', '5a000000-0000-4000-8000-000000000001',
      'operationType', 'upsert',
      'baseVersion', 1,
      'occurredAt', now(),
      'payload', jsonb_build_object('name', 'Nombre obsoleto')
    ))
  )->0->>'result',
  'conflict',
  'device B receives an explicit stale-version conflict'
);
select ok(
  not (select payload ? 'name' from public.traker_sync_operations where operation_id = '50000000-0000-4000-8000-000000000001'),
  'the operation ledger does not retain user content'
);
select is(
  public.traker_apply_sync_operations(
    'device-a',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000003',
      'entityType', 'habit',
      'entityId', '5a000000-0000-4000-8000-000000000001',
      'operationType', 'delete',
      'baseVersion', 2,
      'occurredAt', now(),
      'payload', '{}'::jsonb
    ))
  )->0->>'result',
  'applied',
  'device A can create a versioned tombstone'
);
select ok(
  (select deleted_at is not null from public.habits where id = '5a000000-0000-4000-8000-000000000001'),
  'delete keeps the row as a tombstone'
);
select is(
  public.traker_apply_sync_operations(
    'device-b',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000004',
      'entityType', 'habit',
      'entityId', '5a000000-0000-4000-8000-000000000001',
      'operationType', 'upsert',
      'baseVersion', 2,
      'occurredAt', now(),
      'payload', jsonb_build_object('name', 'No debe revivir')
    ))
  )->0->>'result',
  'conflict',
  'a stale edit cannot overwrite a tombstone'
);
select is(
  public.traker_apply_sync_operations(
    'device-b',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000005',
      'entityType', 'habit',
      'entityId', '5a000000-0000-4000-8000-000000000001',
      'operationType', 'restore',
      'baseVersion', 3,
      'occurredAt', now(),
      'payload', '{}'::jsonb
    ))
  )->0->>'result',
  'applied',
  'restore is a new versioned operation'
);
select ok(
  (select deleted_at is null and version = 4 from public.habits where id = '5a000000-0000-4000-8000-000000000001'),
  'restore clears the tombstone and advances the version'
);

select is(
  public.traker_apply_sync_operations(
    'device-a',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000006',
      'entityType', 'habitLog',
      'entityId', '5b000000-0000-4000-8000-000000000001',
      'operationType', 'upsert',
      'baseVersion', 0,
      'occurredAt', now(),
      'payload', jsonb_build_object(
        'habitId', '5a000000-0000-4000-8000-000000000001',
        'localDate', '2026-08-29',
        'timezone', 'America/Mexico_City',
        'occurrenceKey', 'date:2026-08-29',
        'status', 'done',
        'note', 'contenido privado'
      )
    ))
  )->0->>'result',
  'applied',
  'device A can append a canonical log'
);
select is(
  public.traker_apply_sync_operations(
    'device-a',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000006',
      'entityType', 'habitLog',
      'entityId', '5b000000-0000-4000-8000-000000000001',
      'operationType', 'upsert',
      'baseVersion', 0,
      'occurredAt', now(),
      'payload', '{}'::jsonb
    ))
  )->0->>'result',
  'duplicate',
  'retrying the same operation is idempotent'
);
select is(
  (select count(*)::integer from public.traker_habit_logs where id = '5b000000-0000-4000-8000-000000000001'),
  1,
  'an idempotent retry never duplicates the log'
);
select is(
  public.traker_apply_sync_operations(
    'device-b',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000009',
      'entityType', 'habitLog',
      'entityId', '5b000000-0000-4000-8000-000000000009',
      'operationType', 'upsert',
      'baseVersion', 0,
      'occurredAt', now(),
      'payload', jsonb_build_object(
        'habitId', '5a000000-0000-4000-8000-000000000001',
        'localDate', '2026-08-29',
        'occurrenceKey', 'date:2026-08-29',
        'status', 'partial'
      )
    ))
  )->0->>'result',
  'conflict',
  'two ids for the same occurrence produce an explicit conflict'
);

insert into public.traker_rewards (id, user_id, name)
values (
  '5c000000-0000-4000-8000-000000000001',
  '51111111-1111-4111-8111-111111111111',
  'Café especial'
);
insert into public.traker_reward_rules (id, user_id, reward_id, rule_type, period)
values (
  '5d000000-0000-4000-8000-000000000001',
  '51111111-1111-4111-8111-111111111111',
  '5c000000-0000-4000-8000-000000000001',
  'all',
  'week'
);

select is(
  public.traker_apply_sync_operations(
    'device-a',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000007',
      'entityType', 'rewardClaim',
      'entityId', '5e000000-0000-4000-8000-000000000001',
      'operationType', 'upsert',
      'baseVersion', 0,
      'occurredAt', now(),
      'payload', jsonb_build_object(
        'ruleId', '5d000000-0000-4000-8000-000000000001',
        'periodKey', '2026-W35',
        'unlockedAt', now()
      )
    ))
  )->0->>'result',
  'applied',
  'the first reward claim is accepted'
);
select is(
  public.traker_apply_sync_operations(
    'device-b',
    jsonb_build_array(jsonb_build_object(
      'operationId', '50000000-0000-4000-8000-000000000008',
      'entityType', 'rewardClaim',
      'entityId', '5e000000-0000-4000-8000-000000000002',
      'operationType', 'upsert',
      'baseVersion', 0,
      'occurredAt', now(),
      'payload', jsonb_build_object(
        'ruleId', '5d000000-0000-4000-8000-000000000001',
        'periodKey', '2026-W35',
        'unlockedAt', now()
      )
    ))
  )->0->>'result',
  'duplicate',
  'the same reward period is idempotent across devices'
);
select is(
  (select count(*)::integer from public.traker_reward_claims where period_key = '2026-W35'),
  1,
  'reward idempotency leaves one claim row'
);

select ok(
  jsonb_array_length((public.traker_pull_sync_changes('device-b', null, null, 100))->'changes') > 0,
  'device B can pull changes produced by device A'
);
select ok(
  exists (
    select 1 from public.traker_sync_cursors
    where user_id = '51111111-1111-4111-8111-111111111111'
      and device_id = 'device-b'
      and last_received_at is not null
  ),
  'pull persists a durable device cursor'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements((public.traker_pull_sync_changes('device-a', '-infinity', null, 100))->'changes') c
    join public.traker_sync_operations o on o.operation_id = (c->>'operationId')::uuid
    where o.device_id = 'device-a'
  ),
  'pull excludes operations created by the requesting device'
);

select hasnt_column('public', 'habits', 'linked_goal_id', 'legacy one-to-one goal column is retired');
select hasnt_column('public', 'habits', 'reminder_days', 'legacy weekday column is retired');
select ok(
  position(
    'reminder_days' in pg_get_functiondef('public.traker_apply_sync_operations(text,jsonb)'::regprocedure)
  ) = 0,
  'v2 push RPC no longer writes the retired weekday column'
);

reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
select throws_ok(
  $$ select public.traker_apply_sync_operations('anon-device', '[]'::jsonb) $$,
  '42501',
  'permission denied for function traker_apply_sync_operations',
  'anonymous callers cannot invoke v2 sync'
);

select * from finish();
rollback;

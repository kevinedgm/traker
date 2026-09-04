begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(35);

select has_schema('traker_private', 'private maintenance schema exists');
select has_table('public', 'traker_sync_retention_state', 'retention floor state exists');
select has_function(
  'traker_private',
  'traker_sync_ledger_retention_dry_run',
  array['timestamp with time zone', 'uuid'],
  'content-free dry-run function exists'
);
select has_function(
  'traker_private',
  'traker_compact_sync_ledger',
  array['boolean', 'boolean', 'timestamp with time zone', 'uuid'],
  'manual compact function exists'
);
select has_function(
  'public',
  'traker_acknowledge_sync_rehydration',
  array['text', 'timestamp with time zone', 'uuid'],
  'rehydration acknowledgement RPC exists'
);
select ok(
  not has_schema_privilege('authenticated', 'traker_private', 'usage'),
  'authenticated clients cannot use the private maintenance schema'
);
select ok(
  not has_schema_privilege('anon', 'traker_private', 'usage'),
  'anonymous clients cannot use the private maintenance schema'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'traker_private.traker_sync_ledger_retention_dry_run(timestamptz,uuid)',
    'execute'
  ),
  'authenticated clients cannot execute the dry-run function'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'traker_private.traker_compact_sync_ledger(boolean,boolean,timestamptz,uuid)',
    'execute'
  ),
  'authenticated clients cannot execute compact'
);
select ok(
  has_table_privilege('authenticated', 'public.traker_sync_retention_state', 'select'),
  'owners may read their content-free retention boundary through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.traker_sync_retention_state', 'insert'),
  'clients cannot create retention boundaries'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.traker_acknowledge_sync_rehydration(text,timestamptz,uuid)',
    'execute'
  ),
  'authenticated clients may acknowledge a completed canonical snapshot'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.traker_acknowledge_sync_rehydration(text,timestamptz,uuid)',
    'execute'
  ),
  'anonymous clients cannot acknowledge rehydration'
);

insert into auth.users (id, email)
values
  ('61111111-1111-4111-8111-111111111111', 'retention-empty@traker.local'),
  ('62222222-2222-4222-8222-222222222222', 'retention-small@traker.local'),
  ('63333333-3333-4333-8333-333333333333', 'retention-main@traker.local'),
  ('64444444-4444-4444-8444-444444444444', 'retention-other@traker.local');

select is(
  (
    traker_private.traker_sync_ledger_retention_dry_run(
      '2026-08-31T12:00:00Z',
      '61111111-1111-4111-8111-111111111111'
    )->>'totalRows'
  )::integer,
  0,
  'an empty ledger reports zero rows'
);
select is(
  (
    traker_private.traker_sync_ledger_retention_dry_run(
      '2026-08-31T12:00:00Z',
      '61111111-1111-4111-8111-111111111111'
    )->>'eligibleRows'
  )::integer,
  0,
  'an empty ledger has no compact candidates'
);

insert into public.traker_sync_operations (
  operation_id, user_id, entity_type, entity_id, operation_type,
  base_version, new_version, device_id, occurred_at, received_at, result
) values
  (
    '62000000-0000-4000-8000-000000000001',
    '62222222-2222-4222-8222-222222222222',
    'habit', '62a00000-0000-4000-8000-000000000001', 'upsert',
    0, 1, 'small-a', '2026-01-01', '2026-01-01', 'applied'
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    '62222222-2222-4222-8222-222222222222',
    'habit', '62a00000-0000-4000-8000-000000000001', 'upsert',
    1, 2, 'small-a', '2026-02-01', '2026-02-01', 'applied'
  );

select is(
  (
    traker_private.traker_compact_sync_ledger(
      true,
      false,
      '2026-08-31T12:00:00Z',
      '62222222-2222-4222-8222-222222222222'
    )->>'skipReason'
  ),
  'below_threshold',
  'execution is skipped below 10,000 rows without an explicit force'
);
select is(
  (
    select count(*)::integer
    from public.traker_sync_operations
    where user_id = '62222222-2222-4222-8222-222222222222'
  ),
  2,
  'the below-threshold guard leaves the ledger unchanged'
);

insert into public.habits (id, user_id, title, total_days, version, deleted_at)
values
  (
    '63a00000-0000-4000-8000-000000000001',
    '63333333-3333-4333-8333-333333333333',
    'Entidad normal', 30, 2, null
  ),
  (
    '63a00000-0000-4000-8000-000000000002',
    '63333333-3333-4333-8333-333333333333',
    'Tombstone', 30, 2, '2026-01-10T00:00:00Z'
  );

insert into public.traker_sync_operations (
  operation_id, user_id, entity_type, entity_id, operation_type,
  base_version, new_version, device_id, occurred_at, received_at, result, conflict
) values
  ('63000000-0000-4000-8000-000000000001', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000001', 'upsert', 0, 1, 'device-a', '2026-01-01', '2026-01-01', 'applied', null),
  ('63000000-0000-4000-8000-000000000002', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000001', 'upsert', 1, 2, 'device-a', '2026-02-01', '2026-02-01', 'applied', null),
  ('63000000-0000-4000-8000-000000000003', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000002', 'upsert', 0, 1, 'device-a', '2026-01-02', '2026-01-02', 'applied', null),
  ('63000000-0000-4000-8000-000000000004', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000002', 'delete', 1, 2, 'device-a', '2026-01-10', '2026-01-10', 'applied', null),
  ('63000000-0000-4000-8000-000000000014', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000002', 'restore', 2, null, 'device-b', '2026-02-10', '2026-02-10', 'rejected', '{"code":"invalid_payload"}'),
  ('63000000-0000-4000-8000-000000000005', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000003', 'upsert', 0, 1, 'device-a', '2026-01-03', '2026-01-03', 'applied', null),
  ('63000000-0000-4000-8000-000000000006', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000003', 'upsert', 0, null, 'device-b', '2026-02-03', '2026-02-03', 'conflict', '{"code":"version_mismatch"}'),
  ('63000000-0000-4000-8000-000000000007', '63333333-3333-4333-8333-333333333333', 'rewardClaim', '63d00000-0000-4000-8000-000000000001', 'upsert', 0, 1, 'device-a', '2026-01-04', '2026-01-04', 'applied', null),
  ('63000000-0000-4000-8000-000000000008', '63333333-3333-4333-8333-333333333333', 'rewardClaim', '63d00000-0000-4000-8000-000000000001', 'upsert', 0, 1, 'device-a', '2026-01-08', '2026-01-08', 'duplicate', null),
  ('63000000-0000-4000-8000-000000000009', '63333333-3333-4333-8333-333333333333', 'rewardClaim', '63d00000-0000-4000-8000-000000000001', 'upsert', 0, 1, 'device-a', '2026-02-08', '2026-02-08', 'applied', null),
  ('63000000-0000-4000-8000-000000000010', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000005', 'upsert', 0, 1, 'device-b', '2026-01-05', '2026-01-05', 'applied', null),
  ('63000000-0000-4000-8000-000000000011', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000005', 'upsert', 1, 2, 'device-b', '2026-02-05', '2026-02-05', 'applied', null),
  ('63000000-0000-4000-8000-000000000012', '63333333-3333-4333-8333-333333333333', 'habitLog', '63b00000-0000-4000-8000-000000000006', 'upsert', 0, 1, 'device-a', '2026-01-15', '2026-01-15', 'applied', null),
  ('63000000-0000-4000-8000-000000000013', '63333333-3333-4333-8333-333333333333', 'habitLog', '63b00000-0000-4000-8000-000000000006', 'upsert', 0, 1, 'device-a', '2026-02-15', '2026-02-15', 'applied', null),
  ('63000000-0000-4000-8000-000000000015', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000007', 'upsert', 0, null, 'device-a', '2026-01-20', '2026-01-20', 'pending', null),
  ('63000000-0000-4000-8000-000000000016', '63333333-3333-4333-8333-333333333333', 'habit', '63a00000-0000-4000-8000-000000000008', 'upsert', 0, null, 'device-a', '2026-01-21', '2026-01-21', 'rejected', '{"code":"invalid_payload"}');

insert into public.traker_sync_cursors (
  user_id, device_id, last_received_at, last_operation_id, updated_at
) values
  ('63333333-3333-4333-8333-333333333333', 'device-a', '2026-01-10', '63000000-0000-4000-8000-000000000010', '2026-08-30'),
  ('63333333-3333-4333-8333-333333333333', 'device-b', '2026-03-20', '63000000-0000-4000-8000-000000000016', '2026-08-30'),
  ('63333333-3333-4333-8333-333333333333', 'device-c', '2025-12-01', '63000000-0000-4000-8000-000000000001', '2026-04-01');

select is(
  (
    traker_private.traker_sync_ledger_retention_dry_run(
      '2026-08-31T12:00:00Z',
      '63333333-3333-4333-8333-333333333333'
    )->>'eligibleRows'
  )::integer,
  6,
  'dry-run finds only terminal, old, cursor-safe, non-latest operations'
);
select is(
  (
    traker_private.traker_sync_ledger_retention_dry_run(
      '2026-08-31T12:00:00Z',
      '63333333-3333-4333-8333-333333333333'
    )->>'unresolvedRows'
  )::integer,
  4,
  'dry-run reports unresolved rows without exposing their payloads'
);
select is(
  (
    traker_private.traker_compact_sync_ledger(
      true,
      true,
      '2026-08-31T12:00:00Z',
      '63333333-3333-4333-8333-333333333333'
    )->>'deletedRows'
  )::integer,
  6,
  'forced test execution deletes exactly the dry-run candidates'
);
select ok(
  not exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000001'
  ),
  'an old applied operation behind safe cursors is compacted'
);
select ok(
  not exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000008'
  ),
  'an old duplicate behind safe cursors is compacted'
);
select ok(
  exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000002'
  ),
  'the latest operation for an entity is retained'
);
select ok(
  exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000004'
  ),
  'the active tombstone operation is retained even when a rejected restore is newer'
);
select ok(
  exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000006'
      and result = 'conflict'
  ),
  'an unresolved conflict is retained'
);
select ok(
  exists (
    select 1 from public.traker_sync_operations
    where operation_id in (
      '63000000-0000-4000-8000-000000000014',
      '63000000-0000-4000-8000-000000000015',
      '63000000-0000-4000-8000-000000000016'
    )
    group by user_id
    having count(*) = 3
  ),
  'pending and rejected operations are retained'
);
select ok(
  exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000010'
  ),
  'the 30-day margin behind an active cursor blocks deletion'
);
select ok(
  not exists (
    select 1 from public.traker_sync_operations
    where operation_id = '63000000-0000-4000-8000-000000000012'
  ),
  'a cursor inactive for more than 90 days does not block deletion'
);
select is(
  (
    select deleted_operations::integer
    from public.traker_sync_retention_state
    where user_id = '63333333-3333-4333-8333-333333333333'
  ),
  6,
  'retention state records the compacted count and boundary'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '63333333-3333-4333-8333-333333333333';

select ok(
  (public.traker_pull_sync_changes('returning-device', null, null, 100)->>'rehydrationRequired')::boolean,
  'a device behind the retained floor is sent through full rehydration'
);
select is(
  jsonb_array_length(
    public.traker_pull_sync_changes('returning-device', null, null, 100)->'changes'
  ),
  0,
  'a stale cursor receives no misleading incremental changes'
);

with requested as (
  select public.traker_pull_sync_changes('returning-device', null, null, 100) response
)
select ok(
  (
    public.traker_acknowledge_sync_rehydration(
      'returning-device',
      (response->'cursor'->>'receivedAt')::timestamptz,
      (response->'cursor'->>'operationId')::uuid
    )->>'acknowledged'
  )::boolean,
  'the device can acknowledge only after its canonical snapshot completes'
)
from requested;

select ok(
  not (public.traker_pull_sync_changes('returning-device', null, null, 100)->>'rehydrationRequired')::boolean,
  'an acknowledged device resumes incremental pulls'
);
select is(
  (select count(*)::integer from public.traker_sync_retention_state),
  1,
  'RLS exposes only the current owner retention state'
);

set local "request.jwt.claim.sub" = '64444444-4444-4444-8444-444444444444';
select is(
  (select count(*)::integer from public.traker_sync_retention_state),
  0,
  'RLS hides another owner retention boundary'
);

select * from finish();
rollback;

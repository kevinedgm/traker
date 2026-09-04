-- Sync v2 ledger retention after the Phase 6 cutover.
--
-- The destructive path is private, manual and disabled below 10,000 rows.
-- Client-facing functions only expose content-free cursor boundaries.

begin;

create schema if not exists traker_private;
revoke all on schema traker_private from public, anon, authenticated, service_role;

create table public.traker_sync_retention_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  compacted_through_received_at timestamptz not null,
  compacted_through_operation_id uuid not null,
  deleted_operations bigint not null default 0 check (deleted_operations >= 0),
  last_compacted_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.traker_sync_retention_state enable row level security;

create policy traker_sync_retention_state_owner_select
  on public.traker_sync_retention_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.traker_sync_retention_state from public, anon, authenticated;
grant select on public.traker_sync_retention_state to authenticated;

create index traker_sync_operations_retention_entity_idx
  on public.traker_sync_operations (
    user_id,
    entity_type,
    entity_id,
    received_at desc,
    operation_id desc
  )
  where result in ('applied', 'duplicate');

create or replace function traker_private.traker_sync_ledger_retention_candidates(
  p_now timestamptz default now(),
  p_user_id uuid default null
)
returns table (
  operation_id uuid,
  user_id uuid,
  received_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      o.operation_id,
      o.user_id,
      o.entity_type,
      o.entity_id,
      o.operation_type,
      o.device_id,
      o.received_at,
      row_number() over (
        partition by o.user_id, o.entity_type, o.entity_id
        order by o.received_at desc, o.operation_id desc
      ) as entity_rank
    from public.traker_sync_operations o
    where p_user_id is null or o.user_id = p_user_id
  )
  select r.operation_id, r.user_id, r.received_at
  from ranked r
  where r.entity_rank > 1
    and r.received_at <= p_now - interval '180 days'
    and exists (
      select 1
      from public.traker_sync_operations terminal
      where terminal.operation_id = r.operation_id
        and terminal.user_id = r.user_id
        and terminal.result in ('applied', 'duplicate')
    )
    and not exists (
      select 1
      from public.traker_sync_cursors c
      where c.user_id = r.user_id
        and c.device_id <> r.device_id
        and c.updated_at >= p_now - interval '90 days'
        and (
          c.last_received_at is null
          or c.last_operation_id is null
          or (c.last_received_at, c.last_operation_id) < (r.received_at, r.operation_id)
          or c.last_received_at < r.received_at + interval '30 days'
        )
    )
    and not (
      r.operation_type = 'delete'
      and (
        (
          r.entity_type = 'habit'
          and exists (
            select 1
            from public.habits h
            where h.user_id = r.user_id
              and h.id = r.entity_id
              and h.deleted_at is not null
          )
        )
        or (
          r.entity_type = 'habitLog'
          and exists (
            select 1
            from public.traker_habit_logs l
            where l.user_id = r.user_id
              and l.id = r.entity_id
              and l.deleted_at is not null
          )
        )
      )
    )
  order by r.received_at, r.operation_id;
$$;

create or replace function traker_private.traker_sync_ledger_retention_dry_run(
  p_now timestamptz default now(),
  p_user_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with scoped_operations as (
    select o.result, o.received_at
    from public.traker_sync_operations o
    where p_user_id is null or o.user_id = p_user_id
  ),
  scoped_cursors as (
    select c.updated_at
    from public.traker_sync_cursors c
    where p_user_id is null or c.user_id = p_user_id
  ),
  candidates as (
    select c.received_at
    from traker_private.traker_sync_ledger_retention_candidates(p_now, p_user_id) c
  )
  select jsonb_build_object(
    'mode', 'dry_run',
    'thresholdRows', 10000,
    'totalRows', (select count(*) from scoped_operations),
    'eligibleRows', (select count(*) from candidates),
    'oldestEligibleAt', (select min(received_at) from candidates),
    'newestEligibleAt', (select max(received_at) from candidates),
    'activeDevices', (
      select count(*) from scoped_cursors
      where updated_at >= p_now - interval '90 days'
    ),
    'inactiveDevices', (
      select count(*) from scoped_cursors
      where updated_at < p_now - interval '90 days'
    ),
    'unresolvedRows', (
      select count(*) from scoped_operations
      where result in ('pending', 'conflict', 'rejected')
    ),
    'executionBlockedByThreshold', (select count(*) < 10000 from scoped_operations)
  );
$$;

create or replace function traker_private.traker_compact_sync_ledger(
  p_execute boolean default false,
  p_force boolean default false,
  p_now timestamptz default now(),
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_report jsonb;
  v_total_rows bigint;
  v_deleted_rows bigint := 0;
begin
  v_report := traker_private.traker_sync_ledger_retention_dry_run(p_now, p_user_id);
  v_total_rows := coalesce((v_report->>'totalRows')::bigint, 0);

  if not p_execute then
    return v_report;
  end if;

  if v_total_rows < 10000 and not p_force then
    return v_report || jsonb_build_object(
      'mode', 'execute',
      'skipped', true,
      'skipReason', 'below_threshold',
      'deletedRows', 0
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('traker:sync-ledger-retention', 0)
  );

  -- Recompute after acquiring the lock so report and delete use one boundary.
  v_report := traker_private.traker_sync_ledger_retention_dry_run(p_now, p_user_id);

  insert into public.traker_sync_retention_state (
    user_id,
    compacted_through_received_at,
    compacted_through_operation_id,
    deleted_operations,
    last_compacted_at,
    updated_at
  )
  select distinct on (c.user_id)
    c.user_id,
    c.received_at,
    c.operation_id,
    count(*) over (partition by c.user_id),
    p_now,
    p_now
  from traker_private.traker_sync_ledger_retention_candidates(p_now, p_user_id) c
  order by c.user_id, c.received_at desc, c.operation_id desc
  on conflict (user_id) do update
  set compacted_through_received_at = case
        when (
          excluded.compacted_through_received_at,
          excluded.compacted_through_operation_id
        ) > (
          public.traker_sync_retention_state.compacted_through_received_at,
          public.traker_sync_retention_state.compacted_through_operation_id
        ) then excluded.compacted_through_received_at
        else public.traker_sync_retention_state.compacted_through_received_at
      end,
      compacted_through_operation_id = case
        when (
          excluded.compacted_through_received_at,
          excluded.compacted_through_operation_id
        ) > (
          public.traker_sync_retention_state.compacted_through_received_at,
          public.traker_sync_retention_state.compacted_through_operation_id
        ) then excluded.compacted_through_operation_id
        else public.traker_sync_retention_state.compacted_through_operation_id
      end,
      deleted_operations = public.traker_sync_retention_state.deleted_operations
        + excluded.deleted_operations,
      last_compacted_at = excluded.last_compacted_at,
      updated_at = excluded.updated_at;

  delete from public.traker_sync_operations o
  using traker_private.traker_sync_ledger_retention_candidates(p_now, p_user_id) c
  where o.operation_id = c.operation_id
    and o.user_id = c.user_id;

  get diagnostics v_deleted_rows = row_count;

  return v_report || jsonb_build_object(
    'mode', 'execute',
    'forced', p_force,
    'skipped', false,
    'deletedRows', v_deleted_rows
  );
end;
$$;

revoke all on function
  traker_private.traker_sync_ledger_retention_candidates(timestamptz, uuid),
  traker_private.traker_sync_ledger_retention_dry_run(timestamptz, uuid),
  traker_private.traker_compact_sync_ledger(boolean, boolean, timestamptz, uuid)
from public, anon, authenticated, service_role;

create or replace function public.traker_pull_sync_changes(
  p_device_id text,
  p_after_received_at timestamptz default null,
  p_after_operation_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_after_received_at timestamptz;
  v_after_operation_id uuid;
  v_last_received_at timestamptz;
  v_last_operation_id uuid;
  v_floor_received_at timestamptz;
  v_floor_operation_id uuid;
  v_changes jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_device_id is null or length(btrim(p_device_id)) not between 1 and 160 then
    raise exception 'INVALID_DEVICE_ID' using errcode = '22023';
  end if;
  if p_limit not between 1 and 500 then
    raise exception 'INVALID_LIMIT' using errcode = '22023';
  end if;

  select
    coalesce(p_after_received_at, c.last_received_at, '-infinity'::timestamptz),
    coalesce(p_after_operation_id, c.last_operation_id, '00000000-0000-0000-0000-000000000000'::uuid)
  into v_after_received_at, v_after_operation_id
  from (select 1) seed
  left join public.traker_sync_cursors c
    on c.user_id = v_user_id and c.device_id = p_device_id;

  select s.compacted_through_received_at, s.compacted_through_operation_id
  into v_floor_received_at, v_floor_operation_id
  from public.traker_sync_retention_state s
  where s.user_id = v_user_id;

  if v_floor_received_at is not null
    and (v_after_received_at, v_after_operation_id)
      <= (v_floor_received_at, v_floor_operation_id)
  then
    select o.received_at, o.operation_id
    into v_last_received_at, v_last_operation_id
    from public.traker_sync_operations o
    where o.user_id = v_user_id
      and o.device_id <> p_device_id
      and o.result in ('applied', 'duplicate', 'conflict')
    order by o.received_at desc, o.operation_id desc
    limit 1;

    v_last_received_at := coalesce(v_last_received_at, v_floor_received_at);
    v_last_operation_id := coalesce(v_last_operation_id, v_floor_operation_id);

    return jsonb_build_object(
      'changes', '[]'::jsonb,
      'cursor', jsonb_build_object(
        'receivedAt', v_last_received_at,
        'operationId', v_last_operation_id
      ),
      'retentionFloor', jsonb_build_object(
        'receivedAt', v_floor_received_at,
        'operationId', v_floor_operation_id
      ),
      'hasMore', false,
      'rehydrationRequired', true
    );
  end if;

  with page as (
    select o.*
    from public.traker_sync_operations o
    where o.user_id = v_user_id
      and o.device_id <> p_device_id
      and o.result in ('applied', 'duplicate', 'conflict')
      and (o.received_at, o.operation_id) > (v_after_received_at, v_after_operation_id)
    order by o.received_at, o.operation_id
    limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'operationId', operation_id,
    'entityType', entity_type,
    'entityId', entity_id,
    'operationType', operation_type,
    'newVersion', new_version,
    'result', result,
    'receivedAt', received_at
  ) order by received_at, operation_id), '[]'::jsonb)
  into v_changes
  from page;

  select o.received_at, o.operation_id
  into v_last_received_at, v_last_operation_id
  from public.traker_sync_operations o
  where o.user_id = v_user_id
    and o.device_id <> p_device_id
    and o.result in ('applied', 'duplicate', 'conflict')
    and (o.received_at, o.operation_id) > (v_after_received_at, v_after_operation_id)
  order by o.received_at, o.operation_id
  limit 1 offset greatest(jsonb_array_length(v_changes) - 1, 0);

  v_last_received_at := coalesce(v_last_received_at, v_after_received_at);
  v_last_operation_id := coalesce(v_last_operation_id, v_after_operation_id);

  insert into public.traker_sync_cursors (
    user_id, device_id, last_received_at, last_operation_id
  ) values (
    v_user_id, p_device_id, v_last_received_at, v_last_operation_id
  )
  on conflict (user_id, device_id) do update
  set last_received_at = excluded.last_received_at,
      last_operation_id = excluded.last_operation_id,
      updated_at = now();

  return jsonb_build_object(
    'changes', v_changes,
    'cursor', jsonb_build_object(
      'receivedAt', v_last_received_at,
      'operationId', v_last_operation_id
    ),
    'hasMore', jsonb_array_length(v_changes) = p_limit,
    'rehydrationRequired', false
  );
end;
$$;

revoke all on function public.traker_pull_sync_changes(text, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.traker_pull_sync_changes(text, timestamptz, uuid, integer)
  to authenticated;

create or replace function public.traker_acknowledge_sync_rehydration(
  p_device_id text,
  p_received_at timestamptz,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_floor_received_at timestamptz;
  v_floor_operation_id uuid;
  v_upper_received_at timestamptz;
  v_upper_operation_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_device_id is null or length(btrim(p_device_id)) not between 1 and 160 then
    raise exception 'INVALID_DEVICE_ID' using errcode = '22023';
  end if;
  if p_received_at is null or p_operation_id is null then
    raise exception 'INVALID_REHYDRATION_CURSOR' using errcode = '22023';
  end if;

  select s.compacted_through_received_at, s.compacted_through_operation_id
  into v_floor_received_at, v_floor_operation_id
  from public.traker_sync_retention_state s
  where s.user_id = v_user_id;

  if v_floor_received_at is null
    or (p_received_at, p_operation_id) < (v_floor_received_at, v_floor_operation_id)
  then
    raise exception 'INVALID_REHYDRATION_CURSOR' using errcode = '22023';
  end if;

  select o.received_at, o.operation_id
  into v_upper_received_at, v_upper_operation_id
  from public.traker_sync_operations o
  where o.user_id = v_user_id
    and o.device_id <> p_device_id
    and o.result in ('applied', 'duplicate', 'conflict')
  order by o.received_at desc, o.operation_id desc
  limit 1;

  v_upper_received_at := coalesce(v_upper_received_at, v_floor_received_at);
  v_upper_operation_id := coalesce(v_upper_operation_id, v_floor_operation_id);

  if (p_received_at, p_operation_id) > (v_upper_received_at, v_upper_operation_id) then
    raise exception 'REHYDRATION_CURSOR_AHEAD' using errcode = '22023';
  end if;

  insert into public.traker_sync_cursors (
    user_id, device_id, last_received_at, last_operation_id
  ) values (
    v_user_id, p_device_id, p_received_at, p_operation_id
  )
  on conflict (user_id, device_id) do update
  set last_received_at = case
        when (
          public.traker_sync_cursors.last_received_at,
          public.traker_sync_cursors.last_operation_id
        ) > (excluded.last_received_at, excluded.last_operation_id)
        then public.traker_sync_cursors.last_received_at
        else excluded.last_received_at
      end,
      last_operation_id = case
        when (
          public.traker_sync_cursors.last_received_at,
          public.traker_sync_cursors.last_operation_id
        ) > (excluded.last_received_at, excluded.last_operation_id)
        then public.traker_sync_cursors.last_operation_id
        else excluded.last_operation_id
      end,
      updated_at = now();

  return jsonb_build_object(
    'acknowledged', true,
    'cursor', jsonb_build_object(
      'receivedAt', p_received_at,
      'operationId', p_operation_id
    )
  );
end;
$$;

revoke all on function public.traker_acknowledge_sync_rehydration(text, timestamptz, uuid)
  from public, anon;
grant execute on function public.traker_acknowledge_sync_rehydration(text, timestamptz, uuid)
  to authenticated;

commit;

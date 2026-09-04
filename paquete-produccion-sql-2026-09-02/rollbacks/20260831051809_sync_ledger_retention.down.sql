-- Roll back the Sync v2 ledger retention policy.
--
-- This restores the pre-retention pull contract. It cannot recreate ledger
-- rows previously removed by an explicit compact execution.

begin;

drop function if exists public.traker_acknowledge_sync_rehydration(text, timestamptz, uuid);

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
    'hasMore', jsonb_array_length(v_changes) = p_limit
  );
end;
$$;

revoke all on function public.traker_pull_sync_changes(text, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.traker_pull_sync_changes(text, timestamptz, uuid, integer)
  to authenticated;

drop index if exists public.traker_sync_operations_retention_entity_idx;
drop table if exists public.traker_sync_retention_state;
drop schema if exists traker_private cascade;

commit;

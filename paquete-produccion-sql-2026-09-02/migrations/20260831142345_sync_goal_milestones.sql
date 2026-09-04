-- Sync goal milestones through the same idempotent, consent-gated outbox
-- contract used by the original goals module. Kept as a focused RPC so the
-- established goal/action/session ingestion remains backwards compatible.

create or replace function public.sync_traker_goal_milestone_operations(p_operations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_op jsonb;
  v_payload jsonb;
  v_entity_type text;
  v_entity_id uuid;
  v_operation_id uuid;
  v_base_version integer;
  v_remote_version integer;
  v_results jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.traker_product_consents
    where user_id = v_user_id
      and purpose = 'goals_sync'
      and revoked_at is null
  ) then
    raise exception 'GOALS_SYNC_CONSENT_REQUIRED' using errcode = '42501';
  end if;

  if jsonb_typeof(p_operations) <> 'array' then
    raise exception 'OPERATIONS_MUST_BE_ARRAY' using errcode = '22023';
  end if;

  for v_op in select value from jsonb_array_elements(p_operations)
  loop
    v_operation_id := (v_op->>'operationId')::uuid;
    v_entity_type := v_op->>'entityType';
    v_entity_id := (v_op->>'entityId')::uuid;
    v_base_version := coalesce((v_op->>'baseVersion')::integer, 0);
    v_payload := v_op->'payload';

    if exists (
      select 1
      from public.traker_goal_sync_operations
      where operation_id = v_operation_id and user_id = v_user_id
    ) then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id,
        'status', 'duplicate',
        'entityType', v_entity_type,
        'entityId', v_entity_id
      ));
      continue;
    end if;

    if v_entity_type <> 'goalMilestone' then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id,
        'status', 'error',
        'code', 'UNSUPPORTED_ENTITY',
        'entityType', v_entity_type,
        'entityId', v_entity_id
      ));
      continue;
    end if;

    select version
    into v_remote_version
    from public.traker_goal_milestones
    where id = v_entity_id;

    if v_remote_version is not null and v_remote_version <> v_base_version then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id,
        'status', 'conflict',
        'code', 'VERSION_CONFLICT',
        'entityType', v_entity_type,
        'entityId', v_entity_id,
        'baseVersion', v_base_version,
        'remoteVersion', v_remote_version
      ));
      continue;
    end if;

    insert into public.traker_goal_milestones (
      id,
      user_id,
      goal_id,
      title,
      done_definition,
      status,
      position,
      target_date,
      completed_at,
      evidence_summary,
      version,
      created_at,
      updated_at,
      deleted_at
    ) values (
      v_entity_id,
      v_user_id,
      (v_payload->>'goalId')::uuid,
      v_payload->>'title',
      coalesce(v_payload->>'doneDefinition', ''),
      v_payload->>'status',
      coalesce((v_payload->>'position')::integer, 0),
      nullif(v_payload->>'targetDate', '')::date,
      nullif(v_payload->>'completedAt', '')::timestamptz,
      coalesce(v_payload->>'evidenceSummary', ''),
      (v_payload->>'version')::integer,
      (v_payload->>'createdAt')::timestamptz,
      (v_payload->>'updatedAt')::timestamptz,
      nullif(v_payload->>'deletedAt', '')::timestamptz
    )
    on conflict (id) do update set
      title = excluded.title,
      done_definition = excluded.done_definition,
      status = excluded.status,
      position = excluded.position,
      target_date = excluded.target_date,
      completed_at = excluded.completed_at,
      evidence_summary = excluded.evidence_summary,
      version = excluded.version,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at;

    insert into public.traker_goal_sync_operations (
      operation_id,
      user_id,
      entity_type,
      entity_id,
      operation_type,
      base_version
    ) values (
      v_operation_id,
      v_user_id,
      v_entity_type,
      v_entity_id,
      coalesce(v_op->>'operationType', 'upsert'),
      v_base_version
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'operationId', v_operation_id,
      'status', 'applied',
      'entityType', v_entity_type,
      'entityId', v_entity_id,
      'version', v_payload->'version'
    ));
  end loop;

  return jsonb_build_object('results', v_results, 'processedAt', now());
end;
$$;

revoke all on function public.sync_traker_goal_milestone_operations(jsonb) from public, anon;
grant execute on function public.sync_traker_goal_milestone_operations(jsonb) to authenticated;

-- Refresh the goal sync RPC after adding the horizon column.

-- Traker Metas — idempotent outbox ingestion with optimistic version checks.

create or replace function sync_traker_goal_operations(p_operations jsonb)
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
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (
    select 1 from traker_product_consents
    where user_id = v_user_id and purpose = 'goals_sync' and revoked_at is null
  ) then raise exception 'GOALS_SYNC_CONSENT_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(p_operations) <> 'array' then raise exception 'OPERATIONS_MUST_BE_ARRAY' using errcode = '22023'; end if;

  for v_op in select value from jsonb_array_elements(p_operations)
  loop
    v_operation_id := (v_op->>'operationId')::uuid;
    v_entity_type := v_op->>'entityType';
    v_entity_id := (v_op->>'entityId')::uuid;
    v_base_version := coalesce((v_op->>'baseVersion')::integer, 0);
    v_payload := v_op->'payload';

    if exists (select 1 from traker_goal_sync_operations where operation_id = v_operation_id and user_id = v_user_id) then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id, 'status', 'duplicate', 'entityType', v_entity_type, 'entityId', v_entity_id
      ));
      continue;
    end if;

    v_remote_version := null;
    if v_entity_type = 'goal' then
      select version into v_remote_version from traker_goals where id = v_entity_id;
    elsif v_entity_type = 'goalAction' then
      select version into v_remote_version from traker_goal_actions where id = v_entity_id;
    elsif v_entity_type = 'workSession' then
      select version into v_remote_version from traker_work_sessions where id = v_entity_id;
    elsif v_entity_type <> 'progressEntry' then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id, 'status', 'error', 'code', 'UNSUPPORTED_ENTITY',
        'entityType', v_entity_type, 'entityId', v_entity_id
      ));
      continue;
    end if;

    if v_remote_version is not null and v_remote_version <> v_base_version then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id, 'status', 'conflict', 'code', 'VERSION_CONFLICT',
        'entityType', v_entity_type, 'entityId', v_entity_id,
        'baseVersion', v_base_version, 'remoteVersion', v_remote_version
      ));
      continue;
    end if;

    if v_entity_type = 'goal' then
      insert into traker_goals (
        id, user_id, title, personal_why, desired_outcome, done_definition, horizon, status,
        focus_rank, current_action_id, reformulated_from_goal_id, closed_at, archived_at,
        deleted_at, version, created_at, updated_at
      ) values (
        v_entity_id, v_user_id, v_payload->>'title', coalesce(v_payload->>'personalWhy',''),
        coalesce(v_payload->>'desiredOutcome',''), coalesce(v_payload->>'doneDefinition',''),
        coalesce(nullif(v_payload->>'horizon',''),'short'),
        v_payload->>'status', (v_payload->>'focusRank')::smallint,
        nullif(v_payload->>'currentActionId','')::uuid,
        nullif(v_payload->>'reformulatedFromGoalId','')::uuid,
        nullif(v_payload->>'closedAt','')::timestamptz,
        nullif(v_payload->>'archivedAt','')::timestamptz,
        nullif(v_payload->>'deletedAt','')::timestamptz,
        (v_payload->>'version')::integer,
        (v_payload->>'createdAt')::timestamptz, (v_payload->>'updatedAt')::timestamptz
      ) on conflict (id) do update set
        title = excluded.title, personal_why = excluded.personal_why,
        desired_outcome = excluded.desired_outcome, done_definition = excluded.done_definition,
        horizon = excluded.horizon,
        status = excluded.status, focus_rank = excluded.focus_rank,
        current_action_id = excluded.current_action_id,
        reformulated_from_goal_id = excluded.reformulated_from_goal_id,
        closed_at = excluded.closed_at, archived_at = excluded.archived_at,
        deleted_at = excluded.deleted_at, version = excluded.version, updated_at = excluded.updated_at;

    elsif v_entity_type = 'goalAction' then
      insert into traker_goal_actions (
        id, goal_id, title, minimum_version, energy_level, estimate_bucket, status,
        position_key, blocked_reason, adapted_from_action_id, deleted_at, version, created_at, updated_at
      ) values (
        v_entity_id, (v_payload->>'goalId')::uuid, v_payload->>'title',
        coalesce(v_payload->>'minimumVersion',''), nullif(v_payload->>'energyLevel',''),
        nullif(v_payload->>'estimateBucket',''), v_payload->>'status', v_payload->>'positionKey',
        nullif(v_payload->>'blockedReason',''), nullif(v_payload->>'adaptedFromActionId','')::uuid,
        nullif(v_payload->>'deletedAt','')::timestamptz, (v_payload->>'version')::integer,
        (v_payload->>'createdAt')::timestamptz, (v_payload->>'updatedAt')::timestamptz
      ) on conflict (id) do update set
        title = excluded.title, minimum_version = excluded.minimum_version,
        energy_level = excluded.energy_level, estimate_bucket = excluded.estimate_bucket,
        status = excluded.status, position_key = excluded.position_key,
        blocked_reason = excluded.blocked_reason, adapted_from_action_id = excluded.adapted_from_action_id,
        deleted_at = excluded.deleted_at, version = excluded.version, updated_at = excluded.updated_at;

    elsif v_entity_type = 'workSession' then
      insert into traker_work_sessions (
        id, goal_id, action_id, status, started_at, ended_at, planned_minutes,
        actual_seconds, outcome, device_id, version, created_at, updated_at
      ) values (
        v_entity_id, (v_payload->>'goalId')::uuid, nullif(v_payload->>'actionId','')::uuid,
        v_payload->>'status', (v_payload->>'startedAt')::timestamptz,
        nullif(v_payload->>'endedAt','')::timestamptz,
        nullif(v_payload->>'plannedMinutes','')::integer,
        nullif(v_payload->>'actualSeconds','')::integer,
        nullif(v_payload->>'outcome',''), nullif(v_payload->>'deviceId',''),
        (v_payload->>'version')::integer, (v_payload->>'createdAt')::timestamptz,
        (v_payload->>'updatedAt')::timestamptz
      ) on conflict (id) do update set
        status = excluded.status, ended_at = excluded.ended_at,
        planned_minutes = excluded.planned_minutes, actual_seconds = excluded.actual_seconds,
        outcome = excluded.outcome, device_id = excluded.device_id,
        version = excluded.version, updated_at = excluded.updated_at;

    elsif v_entity_type = 'progressEntry' then
      insert into traker_goal_progress_entries (
        id, goal_id, action_id, session_id, kind, note, evidence_text,
        client_id, occurred_at, created_at
      ) values (
        v_entity_id, (v_payload->>'goalId')::uuid,
        nullif(v_payload->>'actionId','')::uuid, nullif(v_payload->>'sessionId','')::uuid,
        v_payload->>'kind', coalesce(v_payload->>'note',''), coalesce(v_payload->>'evidenceText',''),
        nullif(v_payload->>'clientId',''), (v_payload->>'occurredAt')::timestamptz,
        (v_payload->>'createdAt')::timestamptz
      ) on conflict (id) do nothing;
    end if;

    insert into traker_goal_sync_operations (
      operation_id, user_id, entity_type, entity_id, operation_type, base_version
    ) values (
      v_operation_id, v_user_id, v_entity_type, v_entity_id,
      coalesce(v_op->>'operationType','upsert'), v_base_version
    );
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'operationId', v_operation_id, 'status', 'applied', 'entityType', v_entity_type,
      'entityId', v_entity_id, 'version', v_payload->'version'
    ));
  end loop;
  return jsonb_build_object('results', v_results, 'processedAt', now());
end;
$$;

revoke all on function sync_traker_goal_operations(jsonb) from public;
grant execute on function sync_traker_goal_operations(jsonb) to authenticated;

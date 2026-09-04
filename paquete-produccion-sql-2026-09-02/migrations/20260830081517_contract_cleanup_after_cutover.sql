-- Phase 6: contract cleanup after the approved v2 cutover.
--
-- This migration must only run after the application no longer reads or writes
-- habit_entries, habits.linked_goal_id or habits.reminder_days. It intentionally
-- keeps log provenance columns so a compatibility rollback can reconstruct the
-- retired table without relying on user-content heuristics.

begin;

do $phase6_guard$
declare
  v_missing_logs bigint;
  v_missing_schedules bigint;
  v_missing_goal_links bigint;
begin
  select count(*)
  into v_missing_logs
  from public.habit_entries e
  left join public.traker_habit_logs l
    on l.legacy_entry_id = e.id
  where l.id is null;

  select count(*)
  into v_missing_schedules
  from public.habits h
  where h.reminder_days is not null
    and not exists (
      select 1
      from public.traker_habit_schedules s
      where s.user_id = h.user_id
        and s.habit_id = h.id
        and s.deleted_at is null
        and s.days_of_week = h.reminder_days
    );

  select count(*)
  into v_missing_goal_links
  from public.habits h
  where h.linked_goal_id is not null
    and exists (
      select 1
      from public.traker_goals g
      where g.id = h.linked_goal_id
        and g.user_id = h.user_id
    )
    and not exists (
      select 1
      from public.traker_habit_goal_links l
      where l.user_id = h.user_id
        and l.habit_id = h.id
        and l.goal_id = h.linked_goal_id
        and l.deleted_at is null
    );

  if v_missing_logs > 0 then
    raise exception 'PHASE6_MISSING_CANONICAL_LOGS:%', v_missing_logs
      using errcode = 'check_violation';
  end if;
  if v_missing_schedules > 0 then
    raise exception 'PHASE6_MISSING_CANONICAL_SCHEDULES:%', v_missing_schedules
      using errcode = 'check_violation';
  end if;
  if v_missing_goal_links > 0 then
    raise exception 'PHASE6_MISSING_CANONICAL_GOAL_LINKS:%', v_missing_goal_links
      using errcode = 'check_violation';
  end if;
end;
$phase6_guard$;

-- Keep an exact, server-only compatibility snapshot through the rollback
-- window. It is removed by the paired down migration and is never exposed to
-- PostgREST roles.
create schema traker_phase6_rollback;
revoke all on schema traker_phase6_rollback
  from public, anon, authenticated;

create table traker_phase6_rollback.habits as
select id as habit_id, user_id, linked_goal_id, reminder_days, updated_at
from public.habits;
alter table traker_phase6_rollback.habits
  add primary key (habit_id);

create table traker_phase6_rollback.habit_entries as
select * from public.habit_entries;
alter table traker_phase6_rollback.habit_entries
  add primary key (id);

revoke all on all tables in schema traker_phase6_rollback
  from public, anon, authenticated;

-- Keep the v2 RPC contract but stop mutating the legacy weekday column.
create or replace function public.traker_apply_sync_operations(
  p_device_id text,
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_operation jsonb;
  v_operation_id uuid;
  v_entity_id uuid;
  v_entity_type text;
  v_operation_type text;
  v_base_version integer;
  v_payload jsonb;
  v_remote_version integer;
  v_new_version integer;
  v_result text;
  v_conflict jsonb;
  v_inserted uuid;
  v_results jsonb := '[]'::jsonb;
  v_existing public.traker_sync_operations%rowtype;
  v_habit public.habits%rowtype;
  v_log public.traker_habit_logs%rowtype;
  v_claim_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_device_id is null or length(btrim(p_device_id)) not between 1 and 160 then
    raise exception 'INVALID_DEVICE_ID' using errcode = '22023';
  end if;
  if jsonb_typeof(p_operations) <> 'array' then
    raise exception 'OPERATIONS_MUST_BE_ARRAY' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operations) > 100 then
    raise exception 'SYNC_BATCH_TOO_LARGE' using errcode = '22023';
  end if;

  -- A deterministic lock order prevents two devices with reversed batches
  -- from deadlocking while they edit the same entities.
  for v_operation in
    select value
    from jsonb_array_elements(p_operations)
    order by value->>'entityType', value->>'entityId', value->>'operationId'
  loop
    v_operation_id := null;
    v_entity_id := null;
    v_result := 'rejected';
    v_conflict := null;
    begin
      v_operation_id := (v_operation->>'operationId')::uuid;
      v_entity_id := (v_operation->>'entityId')::uuid;
      v_entity_type := v_operation->>'entityType';
      v_operation_type := v_operation->>'operationType';
      v_base_version := coalesce((v_operation->>'baseVersion')::integer, 0);
      v_payload := coalesce(v_operation->'payload', '{}'::jsonb);

      if v_operation_type not in ('upsert', 'delete', 'restore')
        or v_entity_type not in ('habit', 'habitLog', 'rewardClaim')
        or v_base_version < 0
        or jsonb_typeof(v_payload) <> 'object'
        or pg_column_size(v_payload) > 65536
      then
        raise exception 'INVALID_OPERATION' using errcode = '22023';
      end if;

      v_inserted := null;
      insert into public.traker_sync_operations (
        operation_id, user_id, entity_type, entity_id, operation_type,
        base_version, payload, device_id, occurred_at
      ) values (
        v_operation_id,
        v_user_id,
        v_entity_type,
        v_entity_id,
        v_operation_type,
        v_base_version,
        jsonb_build_object(
          'schema', 2,
          'fields', coalesce((
            select jsonb_agg(key order by key)
            from jsonb_object_keys(v_payload) as key
          ), '[]'::jsonb)
        ),
        p_device_id,
        coalesce((v_operation->>'occurredAt')::timestamptz, now())
      )
      on conflict (operation_id) do nothing
      returning operation_id into v_inserted;

      if v_inserted is null then
        select * into v_existing
        from public.traker_sync_operations o
        where o.operation_id = v_operation_id and o.user_id = v_user_id;

        if not found then
          raise exception 'OPERATION_ID_ALREADY_USED' using errcode = '23505';
        end if;

        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'operationId', v_operation_id,
          'entityId', v_existing.entity_id,
          'entityType', v_existing.entity_type,
          'result', 'duplicate',
          'newVersion', v_existing.new_version,
          'conflict', v_existing.conflict
        ));
        continue;
      end if;

      if v_entity_type = 'habit' then
        select * into v_habit
        from public.habits h
        where h.id = v_entity_id and h.user_id = v_user_id
        for update;

        if not found then
          if v_operation_type <> 'upsert' or v_base_version <> 0 then
            v_result := 'conflict';
            v_conflict := jsonb_build_object('code', 'not_found', 'remoteVersion', null);
            v_new_version := null;
          else
            insert into public.habits (
              id, user_id, title, minimum_version, icon, color, total_days,
              reminder_time, is_active, lifecycle_status,
              timezone, version, created_at, updated_at
            ) values (
              v_entity_id,
              v_user_id,
              coalesce(nullif(v_payload->>'name', ''), nullif(v_payload->>'title', '')),
              coalesce(v_payload->>'minimumVersion', ''),
              v_payload->>'icon',
              v_payload->>'color',
              greatest(1, coalesce((v_payload->>'duration')::integer, 30)),
              nullif(v_payload->>'reminder', ''),
              coalesce((v_payload->>'isActive')::boolean, true),
              coalesce(v_payload->>'lifecycleStatus', 'active'),
              coalesce(v_payload->>'timezone', 'America/Mexico_City'),
              1,
              coalesce((v_payload->>'createdAt')::timestamptz, now()),
              now()
            );
            v_result := 'applied';
            v_new_version := 1;
          end if;
        else
          v_remote_version := v_habit.version;
          if v_base_version <> v_remote_version then
            v_result := 'conflict';
            v_conflict := jsonb_build_object(
              'code', 'version_mismatch',
              'remoteVersion', v_remote_version,
              'tombstoned', v_habit.deleted_at is not null
            );
            v_new_version := v_remote_version;
          elsif v_habit.deleted_at is not null and v_operation_type <> 'restore' then
            v_result := 'conflict';
            v_conflict := jsonb_build_object(
              'code', 'tombstone_wins',
              'remoteVersion', v_remote_version,
              'tombstoned', true
            );
            v_new_version := v_remote_version;
          else
            v_new_version := v_remote_version + 1;
            if v_operation_type = 'delete' then
              update public.habits
              set deleted_at = now(), is_active = false, lifecycle_status = 'archived',
                  version = v_new_version, updated_at = now()
              where id = v_entity_id and user_id = v_user_id;
            elsif v_operation_type = 'restore' then
              update public.habits
              set deleted_at = null, is_active = true, lifecycle_status = 'active',
                  version = v_new_version, updated_at = now()
              where id = v_entity_id and user_id = v_user_id;
            else
              update public.habits
              set title = coalesce(nullif(v_payload->>'name', ''), nullif(v_payload->>'title', ''), title),
                  minimum_version = case when v_payload ? 'minimumVersion' then coalesce(v_payload->>'minimumVersion', '') else minimum_version end,
                  icon = case when v_payload ? 'icon' then v_payload->>'icon' else icon end,
                  color = case when v_payload ? 'color' then v_payload->>'color' else color end,
                  total_days = case when v_payload ? 'duration' then greatest(1, (v_payload->>'duration')::integer) else total_days end,
                  reminder_time = case when v_payload ? 'reminder' then nullif(v_payload->>'reminder', '') else reminder_time end,
                  is_active = case when v_payload ? 'isActive' then (v_payload->>'isActive')::boolean else is_active end,
                  lifecycle_status = case when v_payload ? 'lifecycleStatus' then v_payload->>'lifecycleStatus' else lifecycle_status end,
                  timezone = case when v_payload ? 'timezone' then v_payload->>'timezone' else timezone end,
                  version = v_new_version,
                  updated_at = now()
              where id = v_entity_id and user_id = v_user_id;
            end if;
            v_result := 'applied';
          end if;
        end if;

      elsif v_entity_type = 'habitLog' then
        select * into v_log
        from public.traker_habit_logs l
        where l.id = v_entity_id and l.user_id = v_user_id
        for update;

        if not found then
          if v_operation_type <> 'upsert' or v_base_version <> 0 then
            v_result := 'conflict';
            v_conflict := jsonb_build_object('code', 'not_found', 'remoteVersion', null);
            v_new_version := null;
          else
            -- A different id for the same occurrence is a semantic conflict,
            -- not a generic unique-constraint failure. Lock the occurrence so
            -- concurrent devices receive a deterministic result.
            select * into v_log
            from public.traker_habit_logs l
            where l.user_id = v_user_id
              and l.habit_id = (v_payload->>'habitId')::uuid
              and l.occurrence_key = coalesce(
                v_payload->>'occurrenceKey',
                'date:' || (v_payload->>'localDate')
              )
              and l.deleted_at is null
            for update;

            if found then
              v_result := 'conflict';
              v_new_version := v_log.version;
              v_conflict := jsonb_build_object(
                'code', 'occurrence_conflict',
                'remoteVersion', v_log.version,
                'remoteEntityId', v_log.id
              );
            else
              insert into public.traker_habit_logs (
                id, user_id, habit_id, local_date, timezone, occurrence_key,
                status, minimum_used, note, occurred_at, client_operation_id,
                version, migration_quality
              ) values (
                v_entity_id,
                v_user_id,
                (v_payload->>'habitId')::uuid,
                (v_payload->>'localDate')::date,
                coalesce(v_payload->>'timezone', 'America/Mexico_City'),
                coalesce(v_payload->>'occurrenceKey', 'date:' || (v_payload->>'localDate')),
                coalesce(v_payload->>'status', 'not_done'),
                coalesce((v_payload->>'minimumUsed')::boolean, false),
                coalesce(v_payload->>'note', ''),
                coalesce((v_payload->>'occurredAt')::timestamptz, now()),
                coalesce((v_payload->>'clientOperationId')::uuid, v_operation_id),
                1,
                'native'
              );
              v_result := 'applied';
              v_new_version := 1;
            end if;
          end if;
        else
          v_remote_version := v_log.version;
          if v_base_version <> v_remote_version then
            v_result := 'conflict';
            v_conflict := jsonb_build_object(
              'code', 'version_mismatch',
              'remoteVersion', v_remote_version,
              'tombstoned', v_log.deleted_at is not null
            );
            v_new_version := v_remote_version;
          elsif v_log.deleted_at is not null and v_operation_type <> 'restore' then
            v_result := 'conflict';
            v_conflict := jsonb_build_object(
              'code', 'tombstone_wins',
              'remoteVersion', v_remote_version,
              'tombstoned', true
            );
            v_new_version := v_remote_version;
          else
            v_new_version := v_remote_version + 1;
            if v_operation_type = 'delete' then
              update public.traker_habit_logs
              set deleted_at = now(), version = v_new_version, edited_at = now(), updated_at = now()
              where id = v_entity_id and user_id = v_user_id;
            elsif v_operation_type = 'restore' then
              update public.traker_habit_logs
              set deleted_at = null, version = v_new_version, edited_at = now(), updated_at = now()
              where id = v_entity_id and user_id = v_user_id;
            else
              update public.traker_habit_logs
              set status = case when v_payload ? 'status' then v_payload->>'status' else status end,
                  minimum_used = case when v_payload ? 'minimumUsed' then (v_payload->>'minimumUsed')::boolean else minimum_used end,
                  note = case when v_payload ? 'note' then coalesce(v_payload->>'note', '') else note end,
                  occurred_at = case when v_payload ? 'occurredAt' then (v_payload->>'occurredAt')::timestamptz else occurred_at end,
                  version = v_new_version,
                  edited_at = now(),
                  updated_at = now()
              where id = v_entity_id and user_id = v_user_id;
            end if;
            v_result := 'applied';
          end if;
        end if;

      else
        if v_operation_type <> 'upsert' or v_base_version <> 0 then
          v_result := 'rejected';
          v_conflict := jsonb_build_object('code', 'append_only_entity');
          v_new_version := null;
        else
          insert into public.traker_reward_claims (
            id, user_id, rule_id, period_key, unlocked_at, claimed_at, used_at
          ) values (
            v_entity_id,
            v_user_id,
            (v_payload->>'ruleId')::uuid,
            v_payload->>'periodKey',
            coalesce((v_payload->>'unlockedAt')::timestamptz, now()),
            (v_payload->>'claimedAt')::timestamptz,
            (v_payload->>'usedAt')::timestamptz
          )
          on conflict (user_id, rule_id, period_key) do nothing
          returning id into v_claim_id;

          if v_claim_id is null then
            v_result := 'duplicate';
          else
            v_result := 'applied';
          end if;
          v_new_version := 1;
        end if;
      end if;

      update public.traker_sync_operations
      set result = v_result,
          new_version = v_new_version,
          conflict = v_conflict
      where operation_id = v_operation_id and user_id = v_user_id;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id,
        'entityId', v_entity_id,
        'entityType', v_entity_type,
        'result', v_result,
        'newVersion', v_new_version,
        'conflict', v_conflict
      ));
    exception when others then
      if v_operation_id is not null and v_entity_id is not null then
        insert into public.traker_sync_operations (
          operation_id, user_id, entity_type, entity_id, operation_type,
          base_version, payload, device_id, occurred_at, result, conflict
        ) values (
          v_operation_id,
          v_user_id,
          coalesce(v_entity_type, 'invalid'),
          v_entity_id,
          case when v_operation_type in ('upsert', 'delete', 'restore') then v_operation_type else 'upsert' end,
          greatest(0, coalesce(v_base_version, 0)),
          jsonb_build_object('schema', 2, 'fields', '[]'::jsonb),
          p_device_id,
          now(),
          'rejected',
          jsonb_build_object('code', 'invalid_payload')
        )
        on conflict (operation_id) do update
        set result = 'rejected', conflict = jsonb_build_object('code', 'invalid_payload')
        where public.traker_sync_operations.user_id = v_user_id;
      end if;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id,
        'entityId', v_entity_id,
        'entityType', v_entity_type,
        'result', 'rejected',
        'newVersion', null,
        'conflict', jsonb_build_object('code', 'invalid_payload')
      ));
    end;
  end loop;

  return v_results;
end;
$$;

revoke all on function public.traker_apply_sync_operations(text, jsonb)
  from public, anon;
grant execute on function public.traker_apply_sync_operations(text, jsonb)
  to authenticated;

-- Backfill/reporting functions only make sense while legacy rows are present.
drop function public.traker_backfill_quality();
drop function public.traker_backfill_legacy(uuid);

-- These views were never consumed by the application and read habit_entries.
drop view public.v_habit_streaks;
drop view public.v_habit_completion;
drop view public.v_emotion_frequency;

-- Preserve legacy_entry_id as immutable provenance, but remove its dependency
-- before retiring the compatibility table.
alter table public.traker_habit_logs
  drop constraint traker_habit_logs_legacy_entry_id_fkey;

drop table public.habit_entries;

alter table public.habits
  drop column linked_goal_id,
  drop column reminder_days;

comment on column public.traker_habit_logs.legacy_entry_id is
  'Phase 5 provenance retained through the Phase 6 rollback window; no FK after habit_entries retirement.';

commit;

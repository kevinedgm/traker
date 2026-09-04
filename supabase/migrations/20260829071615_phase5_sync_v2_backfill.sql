-- Phase 5: reversible v2 sync primitives and idempotent legacy backfill.
--
-- The legacy tables remain authoritative for the current reader. This migration
-- only enriches the canonical model and adds opt-in RPCs for the pilot client.

-- ---------------------------------------------------------------------------
-- 1. Migration provenance and idempotent backfill
-- ---------------------------------------------------------------------------

alter table public.traker_habit_schedules
  add column if not exists migration_quality text not null default 'native';

alter table public.traker_habit_schedules
  drop constraint if exists traker_habit_schedules_migration_quality_check;
alter table public.traker_habit_schedules
  add constraint traker_habit_schedules_migration_quality_check
  check (migration_quality in ('native', 'exact', 'inferred'));

alter table public.traker_habit_logs
  add column if not exists migration_quality text not null default 'native',
  add column if not exists legacy_day_number integer,
  add column if not exists legacy_level smallint;

alter table public.traker_habit_logs
  drop constraint if exists traker_habit_logs_migration_quality_check;
alter table public.traker_habit_logs
  add constraint traker_habit_logs_migration_quality_check
  check (migration_quality in ('native', 'exact', 'inferred'));

alter table public.traker_habit_logs
  drop constraint if exists traker_habit_logs_legacy_day_number_check;
alter table public.traker_habit_logs
  add constraint traker_habit_logs_legacy_day_number_check
  check (legacy_day_number is null or legacy_day_number >= 1);

alter table public.traker_habit_logs
  drop constraint if exists traker_habit_logs_legacy_level_check;
alter table public.traker_habit_logs
  add constraint traker_habit_logs_legacy_level_check
  check (legacy_level is null or legacy_level between 0 and 4);

create unique index if not exists traker_habit_logs_legacy_entry_unique
  on public.traker_habit_logs(legacy_entry_id)
  where legacy_entry_id is not null;

create unique index if not exists traker_habit_schedules_backfill_unique
  on public.traker_habit_schedules(habit_id)
  where migration_quality in ('exact', 'inferred') and deleted_at is null;

-- The service-role-only function makes the backfill safely retryable per user
-- during a pilot without exposing a cross-user mutation path to clients.
create or replace function public.traker_backfill_legacy(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedules_created integer := 0;
  v_existing_logs_linked integer := 0;
  v_logs_created integer := 0;
begin
  -- A null legacy weekday list meant every day, so v2 stores it explicitly.
  insert into public.traker_habit_schedules (
    user_id, habit_id, kind, timezone, effective_from, days_of_week,
    is_active, version, migration_quality
  )
  select
    h.user_id,
    h.id,
    'weekdays',
    h.timezone,
    (h.created_at at time zone h.timezone)::date,
    coalesce(h.reminder_days, array[0,1,2,3,4,5,6]::smallint[]),
    h.is_active and h.deleted_at is null,
    1,
    'exact'
  from public.habits h
  where h.reminder_time is not null
    and (p_user_id is null or h.user_id = p_user_id)
    and not exists (
      select 1
      from public.traker_habit_schedules existing
      where existing.user_id = h.user_id
        and existing.habit_id = h.id
        and existing.is_active
        and existing.deleted_at is null
    )
  on conflict (habit_id)
    where migration_quality in ('exact', 'inferred') and deleted_at is null
  do nothing;
  get diagnostics v_schedules_created = row_count;

  -- Current clients already dual-write canonical logs. Link those rows first
  -- and preserve their newer value instead of creating a second occurrence.
  update public.traker_habit_logs l
  set legacy_entry_id = e.id,
      legacy_day_number = e.day_number,
      legacy_level = e.status::smallint
  from public.habit_entries e
  join public.habits h on h.id = e.habit_id
  where l.user_id = h.user_id
    and l.habit_id = e.habit_id
    and (p_user_id is null or h.user_id = p_user_id)
    and l.occurrence_key = 'date:' || (
      (h.created_at at time zone h.timezone)::date + (e.day_number - 1)
    )::text
    and l.deleted_at is null
    and l.legacy_entry_id is null
    and not exists (
      select 1 from public.traker_habit_logs linked
      where linked.legacy_entry_id = e.id
    );
  get diagnostics v_existing_logs_linked = row_count;

  -- Remaining legacy entries only stored a day offset. The reconstructed
  -- local date is deterministic but remains explicitly marked inferred.
  insert into public.traker_habit_logs (
    id, user_id, habit_id, local_date, timezone, occurrence_key, status,
    minimum_used, context_codes, note, occurred_at, client_operation_id,
    version, created_at, updated_at, legacy_entry_id, migration_quality,
    legacy_day_number, legacy_level
  )
  select
    gen_random_uuid(),
    h.user_id,
    e.habit_id,
    (h.created_at at time zone h.timezone)::date + (e.day_number - 1),
    h.timezone,
    'date:' || (
      (h.created_at at time zone h.timezone)::date + (e.day_number - 1)
    )::text,
    case e.status
      when '3' then 'done'
      when '1' then 'partial'
      when '2' then 'partial'
      when '4' then 'conscious_skip'
      else 'not_done'
    end,
    e.status = '1',
    array_remove(array[
      case when e.emotion is not null then 'emotion:' || e.emotion end,
      case when e.energy is not null then 'energy:' || e.energy end
    ], null),
    coalesce(e.note, ''),
    e.created_at,
    gen_random_uuid(),
    1,
    e.created_at,
    e.updated_at,
    e.id,
    'inferred',
    e.day_number,
    e.status::smallint
  from public.habit_entries e
  join public.habits h on h.id = e.habit_id
  where p_user_id is null or h.user_id = p_user_id
  on conflict (legacy_entry_id) where legacy_entry_id is not null do nothing;
  get diagnostics v_logs_created = row_count;

  return jsonb_build_object(
    'schedulesCreated', v_schedules_created,
    'existingLogsLinked', v_existing_logs_linked,
    'logsCreated', v_logs_created
  );
end;
$$;

revoke all on function public.traker_backfill_legacy(uuid)
  from public, anon, authenticated;
grant execute on function public.traker_backfill_legacy(uuid) to service_role;

select public.traker_backfill_legacy(null);

-- ---------------------------------------------------------------------------
-- 2. Private, content-free backfill readiness report
-- ---------------------------------------------------------------------------

create or replace function public.traker_backfill_quality()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_report jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'legacyEntries', (
      select count(*)
      from public.habit_entries e
      join public.habits h on h.id = e.habit_id
      where h.user_id = v_user_id
    ),
    'canonicalLegacyLogs', (
      select count(*)
      from public.traker_habit_logs l
      where l.user_id = v_user_id and l.legacy_entry_id is not null
    ),
    'missingLegacyLogs', (
      select count(*)
      from public.habit_entries e
      join public.habits h on h.id = e.habit_id
      left join public.traker_habit_logs l on l.legacy_entry_id = e.id
      where h.user_id = v_user_id and l.id is null
    ),
    'inferredLogs', (
      select count(*)
      from public.traker_habit_logs l
      where l.user_id = v_user_id and l.migration_quality = 'inferred'
    ),
    'legacyReminders', (
      select count(*) from public.habits h
      where h.user_id = v_user_id and h.reminder_time is not null
    ),
    'backfilledSchedules', (
      select count(*) from public.traker_habit_schedules s
      where s.user_id = v_user_id and s.migration_quality in ('exact', 'inferred')
    ),
    'canonicalSchedules', (
      select count(*) from public.traker_habit_schedules s
      where s.user_id = v_user_id and s.is_active and s.deleted_at is null
    ),
    'missingReminderSchedules', (
      select count(*)
      from public.habits h
      where h.user_id = v_user_id
        and h.reminder_time is not null
        and not exists (
          select 1 from public.traker_habit_schedules s
          where s.user_id = h.user_id
            and s.habit_id = h.id
            and s.is_active
            and s.deleted_at is null
        )
    )
  ) into v_report;

  return v_report;
end;
$$;

revoke all on function public.traker_backfill_quality() from public, anon;
grant execute on function public.traker_backfill_quality() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Idempotent v2 push protocol
-- ---------------------------------------------------------------------------

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
              reminder_time, reminder_days, is_active, lifecycle_status,
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
              case when jsonb_typeof(v_payload->'reminderDays') = 'array'
                then array(select jsonb_array_elements_text(v_payload->'reminderDays')::smallint)
                else null end,
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
                  reminder_days = case when jsonb_typeof(v_payload->'reminderDays') = 'array'
                    then array(select jsonb_array_elements_text(v_payload->'reminderDays')::smallint)
                    else reminder_days end,
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

-- ---------------------------------------------------------------------------
-- 4. Stable keyset pull and durable per-device cursor
-- ---------------------------------------------------------------------------

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

-- The existing owner-only RLS policies remain in force. These grants expose
-- no mutation path to the ledger itself; writes happen only through the RPC.
revoke insert, update, delete on public.traker_sync_operations from authenticated;
grant select on public.traker_sync_operations to authenticated;

create index if not exists traker_sync_operations_pull_idx
  on public.traker_sync_operations(user_id, received_at, operation_id)
  where result in ('applied', 'duplicate', 'conflict');

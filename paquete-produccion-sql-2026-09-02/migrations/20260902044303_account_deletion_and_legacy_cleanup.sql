-- Account deletion support and authorized cleanup of the empty Phase 6
-- rollback schema. The application-facing RPC is callable only with the
-- server-side service role; browsers cannot inspect Auth sessions or global
-- per-owner counts.

drop schema if exists traker_phase6_rollback cascade;

create or replace function traker_private.account_deletion_state(
  p_user_id uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_active boolean := false;
  v_owned_rows bigint := 0;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED' using errcode = '22004';
  end if;

  if p_session_id is not null then
    select exists (
      select 1
      from auth.sessions s
      where s.id = p_session_id
        and s.user_id = p_user_id
    ) into v_session_active;
  end if;

  select sum(owner_rows) into v_owned_rows
  from (
    select count(*) owner_rows from public.habits where user_id = p_user_id
    union all select count(*) from public.settings where user_id = p_user_id
    union all select count(*) from public.push_subscriptions where user_id = p_user_id
    union all select count(*) from public.sent_reminders where user_id = p_user_id
    union all select count(*) from public.traker_goals where user_id = p_user_id
    union all select count(*) from public.traker_goal_sync_operations where user_id = p_user_id
    union all select count(*) from public.traker_product_consents where user_id = p_user_id
    union all select count(*) from public.traker_goal_milestones where user_id = p_user_id
    union all select count(*) from public.traker_work_sessions where user_id = p_user_id
    union all select count(*) from public.traker_habit_goal_links where user_id = p_user_id
    union all select count(*) from public.traker_reward_rule_sources where user_id = p_user_id
    union all select count(*) from public.traker_habit_schedules where user_id = p_user_id
    union all select count(*) from public.traker_flexible_groups where user_id = p_user_id
    union all select count(*) from public.traker_flexible_group_members where user_id = p_user_id
    union all select count(*) from public.traker_habit_logs where user_id = p_user_id
    union all select count(*) from public.traker_daily_checkins where user_id = p_user_id
    union all select count(*) from public.traker_rewards where user_id = p_user_id
    union all select count(*) from public.traker_reward_rules where user_id = p_user_id
    union all select count(*) from public.traker_reward_claims where user_id = p_user_id
    union all select count(*) from public.traker_notification_preferences where user_id = p_user_id
    union all select count(*) from public.traker_notification_jobs where user_id = p_user_id
    union all select count(*) from public.traker_notification_deliveries where user_id = p_user_id
    union all select count(*) from public.traker_sync_operations where user_id = p_user_id
    union all select count(*) from public.traker_sync_cursors where user_id = p_user_id
    union all select count(*) from public.traker_day_closures where user_id = p_user_id
    union all select count(*) from public.traker_sync_retention_state where user_id = p_user_id
  ) counts;

  return jsonb_build_object(
    'sessionActive', v_session_active,
    'ownedRows', coalesce(v_owned_rows, 0)
  );
end;
$$;

revoke all on function traker_private.account_deletion_state(uuid, uuid)
  from public, anon, authenticated, service_role;
grant usage on schema traker_private to service_role;
grant execute on function traker_private.account_deletion_state(uuid, uuid)
  to service_role;

create or replace function public.traker_account_deletion_state(
  p_user_id uuid,
  p_session_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select traker_private.account_deletion_state(p_user_id, p_session_id);
$$;

revoke all on function public.traker_account_deletion_state(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.traker_account_deletion_state(uuid, uuid)
  to service_role;

comment on function public.traker_account_deletion_state(uuid, uuid) is
  'Server-only, content-free account deletion preflight and verification.';

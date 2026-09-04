-- Aggregate the latest activity in Postgres so the worker can support long
-- absences without downloading a user's full log history.
create or replace function public.traker_latest_habit_activity(p_user_ids uuid[])
returns table (user_id uuid, last_activity timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select logs.user_id, max(logs.occurred_at) as last_activity
  from public.traker_habit_logs as logs
  where logs.deleted_at is null
    and logs.user_id = any(p_user_ids)
  group by logs.user_id
$$;

revoke all on function public.traker_latest_habit_activity(uuid[]) from public, anon, authenticated;
grant execute on function public.traker_latest_habit_activity(uuid[]) to service_role;

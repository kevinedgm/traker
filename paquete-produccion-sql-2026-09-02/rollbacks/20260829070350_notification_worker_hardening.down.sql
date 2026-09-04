-- Manual rollback for the long-absence activity aggregate.

revoke execute on function public.traker_latest_habit_activity(uuid[]) from service_role;
drop function if exists public.traker_latest_habit_activity(uuid[]);

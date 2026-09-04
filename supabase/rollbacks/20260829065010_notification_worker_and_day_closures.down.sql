-- Manual rollback for 20260829065010_notification_worker_and_day_closures.sql.
-- Run only when intentionally reverting Phase 4; Supabase CLI has no automatic
-- down-migration command.

revoke execute on function public.traker_claim_notification_jobs(integer, integer) from service_role;
drop function if exists public.traker_claim_notification_jobs(integer, integer);

revoke all on table public.traker_day_closures from authenticated, service_role;
drop policy if exists traker_day_closures_owner_all on public.traker_day_closures;
drop trigger if exists traker_day_closures_updated_at on public.traker_day_closures;
drop table if exists public.traker_day_closures;

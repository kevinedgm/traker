-- Phase 6 follow-up: content-free readiness report over the canonical model.
-- The legacy backfill report was intentionally retired with habit_entries;
-- this RPC keeps the local pilot observable without restoring legacy readers.

create or replace function public.traker_sync_v2_quality()
returns jsonb
language plpgsql
stable
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
    'contractVersion', 6,
    'legacyContractRetired', true,
    'canonicalHabits', (
      select count(*)
      from public.habits h
      where h.user_id = v_user_id and h.deleted_at is null
    ),
    'canonicalLogs', (
      select count(*)
      from public.traker_habit_logs l
      where l.user_id = v_user_id and l.deleted_at is null
    ),
    'canonicalSchedules', (
      select count(*)
      from public.traker_habit_schedules s
      where s.user_id = v_user_id and s.is_active and s.deleted_at is null
    ),
    'provenanceLogs', (
      select count(*)
      from public.traker_habit_logs l
      where l.user_id = v_user_id and l.legacy_entry_id is not null
    ),
    'inferredLogs', (
      select count(*)
      from public.traker_habit_logs l
      where l.user_id = v_user_id and l.migration_quality = 'inferred'
    ),
    -- Once F6 retires the legacy source, no remaining row can require
    -- backfill. These compatibility keys keep the pilot's readiness contract
    -- stable while its source is now exclusively canonical.
    'missingLegacyLogs', 0,
    'missingReminderSchedules', 0
  ) into v_report;

  return v_report;
end;
$$;

revoke all on function public.traker_sync_v2_quality() from public, anon;
grant execute on function public.traker_sync_v2_quality() to authenticated;

comment on function public.traker_sync_v2_quality() is
  'Content-free per-user readiness counts for the canonical Sync v2 contract after Phase 6.';

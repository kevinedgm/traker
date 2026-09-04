begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

select has_function('traker_private', 'traker_notification_retention_dry_run', array['timestamp with time zone'], 'notification retention dry-run exists');
select has_function('traker_private', 'traker_apply_notification_retention', array['timestamp with time zone'], 'notification retention apply exists');
select has_function('traker_private', 'traker_operational_health', array['timestamp with time zone'], 'content-free health report exists');
select ok(not has_function_privilege('authenticated', 'traker_private.traker_operational_health(timestamptz)', 'execute'), 'clients cannot execute operational health');
select ok(not has_function_privilege('service_role', 'traker_private.traker_apply_notification_retention(timestamptz)', 'execute'), 'Edge service role cannot run destructive retention');

insert into auth.users (id, email)
values ('c1000000-0000-4000-8000-000000000001', 'retention-observe@traker.local');

insert into public.sent_reminders (user_id, kind, ref, sent_on, sent_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'morning', 'old', date '2026-06-01', timestamptz '2026-06-01 00:00:00+00'),
  ('c1000000-0000-4000-8000-000000000001', 'morning', 'new', date '2026-08-25', timestamptz '2026-08-25 00:00:00+00');

insert into public.traker_notification_jobs (
  id, user_id, job_key, kind, scheduled_at, expires_at, status, updated_at
) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'old-terminal', 'morning_opening', '2026-05-01', '2026-05-02', 'completed', '2026-05-02'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'new-terminal', 'morning_opening', '2026-08-25', '2026-08-26', 'completed', '2026-08-26'),
  ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'stuck-active', 'morning_opening', '2026-09-01 10:00:00+00', '2026-09-03', 'queued', '2026-09-01 10:00:00+00');

select is((traker_private.traker_notification_retention_dry_run('2026-09-01 12:00:00+00')->>'eligibleSentReminders')::integer, 1, 'dry-run selects the old anti-spam row');
select is((traker_private.traker_notification_retention_dry_run('2026-09-01 12:00:00+00')->>'eligibleTerminalJobs')::integer, 1, 'dry-run selects only old terminal jobs');
select is(traker_private.traker_operational_health('2026-09-01 12:00:00+00')->'alerts'->>'jobsStuck', 'true', 'health flags an overdue active job');
select is(traker_private.traker_operational_health('2026-09-01 12:00:00+00')->>'deliveryFailureRate24h', null, 'health avoids a rate without a sample');

select is((traker_private.traker_apply_notification_retention('2026-09-01 12:00:00+00')->>'deletedTerminalJobs')::integer, 1, 'retention deletes one terminal job');
select is((select count(*)::integer from public.sent_reminders), 1, 'recent anti-spam history remains');
select is((select count(*)::integer from public.traker_notification_jobs where status = 'queued'), 1, 'active queued jobs are never deleted');

select * from finish();
rollback;

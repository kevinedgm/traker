begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(19);

select has_table('public', 'traker_day_closures', 'day closures exist');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.traker_day_closures'::regclass),
  'day closures have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.traker_day_closures', 'select'), 'anon cannot read day closures');
select ok(has_table_privilege('authenticated', 'public.traker_day_closures', 'insert'), 'authenticated can sync own day closures');
select ok(
  to_regprocedure('public.traker_claim_notification_jobs(integer,integer)') is not null,
  'atomic notification claim function exists'
);
select ok(
  not has_function_privilege('authenticated', 'public.traker_claim_notification_jobs(integer,integer)', 'execute'),
  'authenticated clients cannot claim server jobs'
);
select ok(
  has_function_privilege('service_role', 'public.traker_claim_notification_jobs(integer,integer)', 'execute'),
  'service role can claim server jobs'
);
select ok(has_table_privilege('service_role', 'public.traker_notification_jobs', 'update'), 'service role can lease jobs');
select ok(has_table_privilege('service_role', 'public.traker_notification_deliveries', 'insert'), 'service role can create delivery attempts');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'update'), 'service role can invalidate dead subscriptions');
select ok(
  to_regprocedure('public.traker_latest_habit_activity(uuid[])') is not null,
  'latest activity aggregate exists'
);
select ok(
  not has_function_privilege('authenticated', 'public.traker_latest_habit_activity(uuid[])', 'execute'),
  'clients cannot inspect the activity aggregate'
);
select ok(
  has_function_privilege('service_role', 'public.traker_latest_habit_activity(uuid[])', 'execute'),
  'service role can read latest activity'
);

insert into auth.users (id, email)
values ('33333333-3333-4333-8333-333333333333', 'worker@traker.local');

insert into public.habits (id, user_id, title, total_days)
values ('33333333-0000-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'Caminar', 30);

insert into public.traker_habit_logs (
  user_id, habit_id, local_date, occurrence_key, status, occurred_at, client_operation_id
)
values (
  '33333333-3333-4333-8333-333333333333',
  '33333333-0000-4333-8333-333333333333',
  current_date - 20,
  'date:old-activity',
  'done',
  now() - interval '20 days',
  '33333333-1111-4333-8333-333333333333'
);

insert into public.traker_notification_jobs (
  id, user_id, job_key, kind, scheduled_at, expires_at, status, lease_until
)
values
  ('30000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'due', 'morning_opening', now() - interval '1 minute', now() + interval '1 hour', 'queued', null),
  ('30000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'future', 'evening_close', now() + interval '1 hour', now() + interval '2 hours', 'queued', null),
  ('30000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'expired', 'return_nudge', now() - interval '2 hours', now() - interval '1 hour', 'queued', null),
  ('30000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333', 'recover-lease', 'habit_or_block', now() - interval '5 minutes', now() + interval '1 hour', 'leased', now() - interval '1 minute');

set local role service_role;

select is(
  (select last_activity::date from public.traker_latest_habit_activity(array['33333333-3333-4333-8333-333333333333'::uuid])),
  (current_date - 20),
  'latest activity survives absences longer than the worker lookback'
);

select is(
  (select count(*)::integer from public.traker_claim_notification_jobs(20, 120)),
  2,
  'claim leases due and abandoned jobs only'
);
select is(
  (select status from public.traker_notification_jobs where job_key = 'expired'),
  'expired',
  'claim expires stale jobs before delivery'
);
select is(
  (select status from public.traker_notification_jobs where job_key = 'future'),
  'queued',
  'future jobs stay queued'
);
select is(
  (select attempt_count from public.traker_notification_jobs where job_key = 'due'),
  1,
  'claim increments the attempt ledger'
);
select ok(
  (select lease_until > now() from public.traker_notification_jobs where job_key = 'recover-lease'),
  'recovered jobs receive a fresh lease'
);

select * from finish();
rollback;

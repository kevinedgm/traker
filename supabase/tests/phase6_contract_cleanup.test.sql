begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

select hasnt_table('public', 'habit_entries', 'legacy habit entries table is retired');
select hasnt_column('public', 'habits', 'linked_goal_id', 'legacy goal link column is retired');
select hasnt_column('public', 'habits', 'reminder_days', 'legacy weekday column is retired');
select ok(
  not exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname in ('v_habit_streaks', 'v_habit_completion', 'v_emotion_frequency')
  ),
  'legacy analytics views are retired'
);
select hasnt_function('public', 'traker_backfill_quality', array[]::text[], 'quality report RPC is retired');
select hasnt_function('public', 'traker_backfill_legacy', array['uuid'], 'legacy backfill RPC is retired');
select has_function('public', 'traker_sync_v2_quality', array[]::text[], 'canonical Sync v2 quality RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.traker_sync_v2_quality()', 'execute'),
  'authenticated users can execute the canonical quality RPC'
);
select ok(
  not has_function_privilege('anon', 'public.traker_sync_v2_quality()', 'execute'),
  'anonymous users cannot execute the canonical quality RPC'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '61111111-1111-4111-8111-111111111111';

select is(
  public.traker_sync_v2_quality()->>'contractVersion',
  '6',
  'quality report identifies the canonical contract version'
);
select is(
  public.traker_sync_v2_quality()->>'legacyContractRetired',
  'true',
  'quality report confirms the legacy contract is retired'
);
select ok(
  (public.traker_sync_v2_quality()->>'missingLegacyLogs')::integer = 0
  and (public.traker_sync_v2_quality()->>'missingReminderSchedules')::integer = 0,
  'canonical readiness reports no legacy backfill gaps'
);

reset role;
set local "request.jwt.claim.sub" = '';
select hasnt_schema('traker_phase6_rollback', 'the authorized empty rollback archive is retired');

select * from finish();
rollback;

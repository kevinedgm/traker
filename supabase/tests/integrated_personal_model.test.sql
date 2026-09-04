begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- Core relations exist.
select has_table('public', 'traker_goal_milestones', 'goal milestones exist');
select has_table('public', 'traker_habit_goal_links', 'habit-goal links exist');
select has_table('public', 'traker_habit_schedules', 'habit schedules exist');
select has_table('public', 'traker_flexible_groups', 'flexible groups exist');
select has_table('public', 'traker_flexible_group_members', 'flexible group members exist');
select has_table('public', 'traker_habit_logs', 'v2 habit logs exist');
select has_table('public', 'traker_daily_checkins', 'daily check-ins exist');
select has_table('public', 'traker_rewards', 'rewards exist');
select has_table('public', 'traker_reward_rules', 'reward rules exist');
select has_table('public', 'traker_reward_rule_sources', 'reward rule sources exist');
select has_table('public', 'traker_reward_claims', 'reward claims exist');
select has_table('public', 'traker_notification_preferences', 'notification preferences exist');
select has_table('public', 'traker_notification_jobs', 'notification jobs exist');
select has_table('public', 'traker_notification_deliveries', 'notification deliveries exist');
select has_table('public', 'traker_sync_operations', 'general sync operations exist');
select has_table('public', 'traker_sync_cursors', 'sync cursors exist');

-- RLS and view hardening.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.traker_habit_logs'::regclass),
  'habit logs have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.traker_daily_checkins'::regclass),
  'daily check-ins have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.traker_notification_jobs'::regclass),
  'notification jobs have RLS enabled'
);
select ok(
  to_regclass('public.v_emotion_frequency') is null,
  'legacy emotion view is retired after the Phase 6 cutover'
);
select ok(not has_table_privilege('anon', 'public.habits', 'select'), 'anon cannot select habits');
select ok(not has_table_privilege('anon', 'public.traker_daily_checkins', 'select'), 'anon cannot select check-ins');
select ok(has_table_privilege('authenticated', 'public.habits', 'select'), 'authenticated can reach habits through Data API');
select ok(has_table_privilege('authenticated', 'public.traker_habit_logs', 'insert'), 'authenticated can insert v2 logs');
select ok(not has_table_privilege('authenticated', 'public.traker_notification_jobs', 'insert'), 'clients cannot create notification jobs');

-- Two isolated users.
insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'a@traker.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@traker.local');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

insert into public.habits (id, user_id, title, total_days)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Practicar inglés',
  30
);

insert into public.traker_goals (
  id, user_id, title, status, horizon
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Preparar TOEFL',
    'active',
    'short'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'Buscar trabajo remoto',
    'active',
    'long'
  );

insert into public.traker_habit_goal_links (user_id, habit_id, goal_id)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1000000-0000-4000-8000-000000000002'
  );

select is(
  (select count(*)::integer from public.traker_habit_goal_links),
  2,
  'one habit can support two goals without duplication'
);

insert into public.traker_goal_actions (
  id, goal_id, title, status, position_key
)
values (
  'ac100000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Estudiar 15 minutos',
  'ready',
  'a'
);

insert into public.traker_work_sessions (
  id, goal_id, action_id, status, started_at
)
values (
  '5e551000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'ac100000-0000-4000-8000-000000000001',
  'running',
  now()
);

select is(
  (select user_id from public.traker_work_sessions where id = '5e551000-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'work session owner is derived from its goal'
);

set constraints public.traker_goals_current_action_same_goal_fk immediate;
select throws_ok(
  $$
    update public.traker_goals
    set current_action_id = 'ac100000-0000-4000-8000-000000000001'
    where id = 'a1000000-0000-4000-8000-000000000002'
  $$,
  '23503',
  'insert or update on table "traker_goals" violates foreign key constraint "traker_goals_current_action_same_goal_fk"',
  'current action must belong to the same goal'
);

reset role;
set local "request.jwt.claim.sub" = '';

insert into public.habits (id, user_id, title, total_days)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'Hábito privado B',
  30
);

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

select is(
  (select count(*)::integer from public.habits),
  1,
  'RLS only exposes the current user habits'
);
select is(
  (select count(*)::integer from public.habits where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'RLS hides the other user habit'
);

select throws_ok(
  $$
    insert into public.habits (id, user_id, title, total_days)
    values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '22222222-2222-4222-8222-222222222222',
      'Intento cruzado',
      30
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "habits"',
  'RLS rejects writing another user habit'
);

select * from finish();
rollback;

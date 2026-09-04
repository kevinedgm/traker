begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email)
values ('33333333-3333-4333-8333-333333333333', 'schedule@traker.local');

set local role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-4333-8333-333333333333';

insert into public.habits (id, user_id, title, total_days)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '33333333-3333-4333-8333-333333333333',
  'Practicar con ritmo flexible',
  90
);

select lives_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, days_of_week)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'weekdays', array[1,3,5])$$,
  'specific weekdays are accepted'
);

select lives_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, period_minimum, period_target, period_extra)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'times_per_week', 3, 4, 5)$$,
  'bounded weekly targets are accepted'
);

select lives_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, period_minimum, period_target, period_extra)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'times_per_month', 8, 12, 16)$$,
  'bounded monthly targets are accepted'
);

select lives_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, interval_days)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'every_n_days', 3)$$,
  'an every-n-days interval is accepted'
);

select lives_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, window_start, window_end)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'window', '20:00', '02:00')$$,
  'a flexible window may cross midnight'
);

select throws_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, period_minimum, period_target, period_extra)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'times_per_week', 8, 8, 8)$$,
  '23514',
  null,
  'a weekly minimum above seven is rejected'
);

select throws_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, window_start, window_end)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'window', '09:00', '09:00')$$,
  '23514',
  null,
  'an empty flexible window is rejected'
);

select throws_ok(
  $$insert into public.traker_habit_schedules
    (user_id, habit_id, kind, days_of_week, interval_days)
    values ('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'weekdays', array[1], 2)$$,
  '23514',
  null,
  'payloads from different schedule kinds cannot be mixed'
);

select * from finish();
rollback;

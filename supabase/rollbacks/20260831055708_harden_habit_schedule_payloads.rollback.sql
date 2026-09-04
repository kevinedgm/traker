alter table public.traker_habit_schedules
  drop constraint if exists traker_habit_schedules_kind_payload_check;

alter table public.traker_habit_schedules
  add constraint traker_habit_schedules_kind_payload_check
  check (
    (kind = 'weekdays' and days_of_week is not null)
    or (kind = 'times_per_week' and period_minimum is not null)
    or (kind = 'times_per_month' and period_minimum is not null)
    or (kind = 'every_n_days' and interval_days is not null)
    or kind = 'window'
  );

-- Block 3A: make every canonical schedule kind safe to expose in the client.
-- Existing weekday rows already satisfy this stricter payload contract.

alter table public.traker_habit_schedules
  drop constraint if exists traker_habit_schedules_kind_payload_check;

alter table public.traker_habit_schedules
  add constraint traker_habit_schedules_kind_payload_check
  check (
    (
      kind = 'weekdays'
      and days_of_week is not null
      and interval_days is null
      and period_minimum is null
      and period_target is null
      and period_extra is null
      and window_start is null
      and window_end is null
    )
    or (
      kind = 'times_per_week'
      and days_of_week is null
      and interval_days is null
      and period_minimum between 1 and 7
      and (period_target is null or period_target <= 7)
      and (period_extra is null or period_extra <= 7)
      and window_start is null
      and window_end is null
    )
    or (
      kind = 'times_per_month'
      and days_of_week is null
      and interval_days is null
      and period_minimum between 1 and 31
      and (period_target is null or period_target <= 31)
      and (period_extra is null or period_extra <= 31)
      and window_start is null
      and window_end is null
    )
    or (
      kind = 'every_n_days'
      and days_of_week is null
      and interval_days is not null
      and period_minimum is null
      and period_target is null
      and period_extra is null
      and window_start is null
      and window_end is null
    )
    or (
      kind = 'window'
      and days_of_week is null
      and interval_days is null
      and period_minimum is null
      and period_target is null
      and period_extra is null
      and window_start is not null
      and window_end is not null
      and window_start <> window_end
    )
  );

comment on constraint traker_habit_schedules_kind_payload_check
  on public.traker_habit_schedules is
  'Requires one bounded payload per schedule kind; windows may cross midnight but cannot be empty.';

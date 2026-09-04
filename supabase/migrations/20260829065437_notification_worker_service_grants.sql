-- Supabase's service_role bypasses RLS but still needs explicit relation
-- privileges after the application's PUBLIC grants were revoked.
grant select on table
  public.settings,
  public.habits,
  public.traker_habit_schedules,
  public.traker_habit_logs,
  public.traker_day_closures,
  public.traker_notification_preferences
to service_role;

grant select, update on table public.push_subscriptions to service_role;
grant select, insert, update on table public.traker_notification_jobs to service_role;
grant select, insert, update on table public.traker_notification_deliveries to service_role;

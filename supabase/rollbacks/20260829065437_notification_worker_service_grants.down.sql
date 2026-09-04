-- Manual rollback for the worker's explicit service-role grants.

revoke select on table
  public.settings,
  public.habits,
  public.traker_habit_schedules,
  public.traker_habit_logs,
  public.traker_notification_preferences
from service_role;

revoke select, update on table public.push_subscriptions from service_role;
revoke select, insert, update on table public.traker_notification_jobs from service_role;
revoke select, insert, update on table public.traker_notification_deliveries from service_role;

-- Content-free operational retention for the notification subsystem.
-- Maintenance remains private: no Data API role can execute these functions.

create or replace function traker_private.traker_notification_retention_dry_run(
  p_now timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'asOf', p_now,
    'sentReminderDays', 35,
    'notificationDays', 90,
    'eligibleSentReminders', (
      select count(*) from public.sent_reminders where sent_at < p_now - interval '35 days'
    ),
    'eligibleTerminalJobs', (
      select count(*) from public.traker_notification_jobs
      where status in ('completed', 'suppressed', 'expired')
        and updated_at < p_now - interval '90 days'
    ),
    'eligibleInvalidSubscriptions', (
      select count(*) from public.push_subscriptions
      where invalidated_at < p_now - interval '90 days'
    )
  );
$$;

create or replace function traker_private.traker_apply_notification_retention(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_sent bigint;
  v_jobs bigint;
  v_subscriptions bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('traker:notification-retention', 0)
  );

  delete from public.sent_reminders
  where sent_at < p_now - interval '35 days';
  get diagnostics v_sent = row_count;

  delete from public.traker_notification_jobs
  where status in ('completed', 'suppressed', 'expired')
    and updated_at < p_now - interval '90 days';
  get diagnostics v_jobs = row_count;

  delete from public.push_subscriptions
  where invalidated_at < p_now - interval '90 days';
  get diagnostics v_subscriptions = row_count;

  return jsonb_build_object(
    'appliedAt', p_now,
    'deletedSentReminders', v_sent,
    'deletedTerminalJobs', v_jobs,
    'deletedInvalidSubscriptions', v_subscriptions
  );
end;
$$;

create or replace function traker_private.traker_operational_health(
  p_now timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with delivery as (
    select
      count(*) filter (where created_at >= p_now - interval '24 hours') as attempts_24h,
      count(*) filter (
        where created_at >= p_now - interval '24 hours'
          and status in ('failed', 'invalid_subscription')
      ) as failures_24h
    from public.traker_notification_deliveries
  ), health as (
    select
      (select count(*) from public.traker_notification_jobs
       where status = 'queued'
         and coalesce(next_attempt_at, scheduled_at) < p_now - interval '15 minutes'
         and expires_at > p_now) as stuck_jobs,
      (select count(*) from public.traker_notification_jobs
       where status = 'leased' and lease_until < p_now) as expired_leases,
      (select count(*) from public.push_subscriptions where invalidated_at is not null) as invalid_subscriptions,
      (select count(*) from public.traker_sync_operations
       where result in ('pending', 'conflict', 'rejected')) as unresolved_sync,
      delivery.attempts_24h,
      delivery.failures_24h
    from delivery
  )
  select jsonb_build_object(
    'asOf', p_now,
    'stuckJobs', stuck_jobs,
    'expiredLeases', expired_leases,
    'invalidSubscriptions', invalid_subscriptions,
    'unresolvedSyncOperations', unresolved_sync,
    'deliveryAttempts24h', attempts_24h,
    'deliveryFailures24h', failures_24h,
    'deliveryFailureRate24h', case when attempts_24h = 0 then null
      else round(failures_24h::numeric / attempts_24h, 4) end,
    'alerts', jsonb_build_object(
      'jobsStuck', stuck_jobs > 0 or expired_leases > 0,
      'deliveryFailureRateHigh', attempts_24h >= 20
        and failures_24h::numeric / attempts_24h > 0.20,
      'syncNeedsReview', unresolved_sync > 0
    )
  ) from health;
$$;

revoke all on function traker_private.traker_notification_retention_dry_run(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function traker_private.traker_apply_notification_retention(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function traker_private.traker_operational_health(timestamptz)
  from public, anon, authenticated, service_role;

comment on function traker_private.traker_operational_health(timestamptz) is
  'Content-free health counts and explicit operational thresholds; never productivity analytics.';

-- Reliable notification worker and privacy-safe day closure sync.

create table public.traker_day_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null default 'America/Mexico_City',
  status text not null check (status in ('sufficient', 'moved', 'quiet')),
  summary jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traker_day_closures_user_date_unique unique (user_id, local_date)
);

create index traker_day_closures_user_date_idx
  on public.traker_day_closures(user_id, local_date desc);

create trigger traker_day_closures_updated_at
  before update on public.traker_day_closures
  for each row execute function public.set_updated_at();

alter table public.traker_day_closures enable row level security;

create policy traker_day_closures_owner_all on public.traker_day_closures
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.traker_day_closures from public, anon;
grant select, insert, update, delete on table public.traker_day_closures to authenticated;

-- Claiming uses a short database transaction and SKIP LOCKED. Network I/O is
-- performed later by the Edge Function while the row is protected by a lease.
create or replace function public.traker_claim_notification_jobs(
  p_limit integer default 20,
  p_lease_seconds integer default 120
)
returns setof public.traker_notification_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.traker_notification_jobs
  set status = 'expired',
      lease_until = null,
      suppression_reason = coalesce(suppression_reason, 'expired_before_delivery')
  where status in ('queued', 'leased')
    and expires_at <= clock_timestamp();

  return query
  with candidates as (
    select job.id
    from public.traker_notification_jobs as job
    where job.expires_at > clock_timestamp()
      and job.scheduled_at <= clock_timestamp()
      and coalesce(job.next_attempt_at, job.scheduled_at) <= clock_timestamp()
      and (
        job.status = 'queued'
        or (job.status = 'leased' and job.lease_until < clock_timestamp())
      )
    order by coalesce(job.next_attempt_at, job.scheduled_at), job.scheduled_at, job.id
    for update skip locked
    limit least(100, greatest(1, coalesce(p_limit, 20)))
  )
  update public.traker_notification_jobs as job
  set status = 'leased',
      lease_until = clock_timestamp() + make_interval(secs => least(900, greatest(30, coalesce(p_lease_seconds, 120)))),
      attempt_count = job.attempt_count + 1
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

revoke all on function public.traker_claim_notification_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.traker_claim_notification_jobs(integer, integer) to service_role;

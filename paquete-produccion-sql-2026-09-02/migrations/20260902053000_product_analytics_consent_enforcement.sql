-- Content-free, consent-gated product analytics.
-- The browser may only append an allowlisted event while the owner has an
-- active analytics consent. No free text or user content is accepted.

create table if not exists public.traker_product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'activation', 'return', 'habit_log', 'day_close',
    'sync_conflict', 'notification_delivery'
  )),
  duration_bucket text check (duration_bucket is null or duration_bucket in (
    'under_10s', '10s_to_60s', '1m_to_5m', 'over_5m'
  )),
  error_code text check (error_code is null or error_code in (
    'network', 'timeout', 'conflict', 'validation', 'unknown'
  )),
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint traker_product_events_expiry_check check (expires_at > occurred_at)
);

create index if not exists traker_product_events_owner_time_idx
  on public.traker_product_events (user_id, occurred_at desc);
create index if not exists traker_product_events_expiry_idx
  on public.traker_product_events (expires_at);

alter table public.traker_product_events enable row level security;

drop policy if exists traker_product_events_owner_select on public.traker_product_events;
create policy traker_product_events_owner_select
  on public.traker_product_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists traker_product_events_owner_insert_with_consent on public.traker_product_events;
create policy traker_product_events_owner_insert_with_consent
  on public.traker_product_events for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.traker_product_consents consent
      where consent.user_id = (select auth.uid())
        and consent.purpose in ('goals_analytics', 'product_analytics')
        and consent.revoked_at is null
    )
  );

drop policy if exists traker_product_events_owner_delete on public.traker_product_events;
create policy traker_product_events_owner_delete
  on public.traker_product_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.traker_product_events from public, anon;
revoke all on table public.traker_product_events from authenticated;
grant select, insert, delete on table public.traker_product_events to authenticated;
grant all on table public.traker_product_events to service_role;

comment on table public.traker_product_events is
  'Content-free product events. Strict enums only; no notes, names, emotions, categories or arbitrary payloads.';


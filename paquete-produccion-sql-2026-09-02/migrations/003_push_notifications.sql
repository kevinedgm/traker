-- ════════════════════════════════════════════════════════════════════
-- Traker — Phase 2: Web Push notifications
--
-- Run AFTER 001 + 002, in the Supabase SQL Editor.
-- Everything here is additive: no table renames, no data loss.
--
-- Adds:
--   1. push_subscriptions  — one row per device/browser push endpoint
--   2. sent_reminders      — server-side anti-spam ledger (1 send/day/thing)
--   3. habits.reminder_days — weekday list, was localStorage-only until now
--   4. settings.*           — reminder preferences + timezone for the cron
-- ════════════════════════════════════════════════════════════════════


-- ── 1. Push subscriptions ────────────────────────────────────────────────

create table if not exists push_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,

  endpoint     text        not null unique,
  p256dh       text        not null,
  auth         text        not null,
  user_agent   text,

  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions: users own their rows"
  on push_subscriptions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions(user_id);


-- ── 2. Sent-reminders ledger (anti-spam) ─────────────────────────────────
-- Written ONLY by the edge function (service role). RLS on with no
-- policies = clients can't touch it; service role bypasses RLS.

create table if not exists sent_reminders (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  kind     text not null check (kind in ('habit','morning','inactivity','closing')),
  ref      text not null default '-',      -- habit id for kind='habit', '-' otherwise
  sent_on  date not null,
  sent_at  timestamptz not null default now(),

  unique (user_id, kind, ref, sent_on)
);

alter table sent_reminders enable row level security;

create index if not exists sent_reminders_user_day_idx
  on sent_reminders(user_id, sent_on);


-- ── 3. Habit reminder weekdays ───────────────────────────────────────────
-- 0 = Sunday … 6 = Saturday (same convention as JS Date.getDay()).
-- null = every day.

alter table habits
  add column if not exists reminder_days smallint[];


-- ── 4. Reminder settings + timezone ──────────────────────────────────────

alter table settings
  add column if not exists timezone                    text    not null default 'America/Mexico_City',
  add column if not exists morning_reminder_enabled    boolean not null default true,
  add column if not exists morning_reminder_time       text    not null default '08:00',
  add column if not exists inactivity_reminder_enabled boolean not null default true,
  add column if not exists inactivity_reminder_time    text    not null default '20:00';

alter table settings
  drop constraint if exists settings_morning_time_check,
  add constraint settings_morning_time_check
    check (morning_reminder_time ~ '^\d{2}:\d{2}$');

alter table settings
  drop constraint if exists settings_inactivity_time_check,
  add constraint settings_inactivity_time_check
    check (inactivity_reminder_time ~ '^\d{2}:\d{2}$');


-- ════════════════════════════════════════════════════════════════════
-- 5. CRON — run this block ONCE, after deploying the edge function.
--
-- Project ref is already filled in (tuzwecxijdblgihidhyo).
-- Replace <CRON-SECRET> with the value from supabase/.env.vapid
-- (the same one you set via: supabase secrets set CRON_SECRET=...).
--
-- Runs every 10 minutes; the function matches reminders that fell
-- inside the last 10-minute window, so nothing is missed or doubled.
-- ════════════════════════════════════════════════════════════════════

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'traker-send-reminders',
--   '*/10 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://tuzwecxijdblgihidhyo.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer <CRON-SECRET>'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- To inspect / remove later:
--   select * from cron.job;
--   select cron.unschedule('traker-send-reminders');

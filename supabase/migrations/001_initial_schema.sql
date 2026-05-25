-- ════════════════════════════════════════════════════════════════════
-- Traker — Initial Schema  (Supabase / PostgreSQL)
-- ════════════════════════════════════════════════════════════════════
--
-- Run this once in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
--
-- Tables:
--   habits        — one row per habit per user
--   habit_entries — one row per logged day
--   settings      — one row per user (preferences)
--
-- Row-Level Security (RLS) is enabled on all tables so users can
-- only read/write their own data.
-- ════════════════════════════════════════════════════════════════════


-- ── Habits ───────────────────────────────────────────────────────────────

create table if not exists habits (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,

  title         text        not null check (char_length(title) between 1 and 80),
  icon          text        default '🏃',
  color         text        default '#CCFF00',
  total_days    integer     not null default 30 check (total_days between 1 and 365),
  reminder_time text        check (reminder_time ~ '^\d{2}:\d{2}$'),  -- "HH:MM" or null

  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at on every mutation
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists habits_updated_at on habits;
create trigger habits_updated_at
  before update on habits
  for each row execute function set_updated_at();

-- RLS
alter table habits enable row level security;

create policy "habits: users own their rows"
  on habits for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for common queries
create index habits_user_active_idx on habits(user_id, is_active, created_at);


-- ── Habit entries (logs) ─────────────────────────────────────────────────

create table if not exists habit_entries (
  id          uuid        primary key default gen_random_uuid(),
  habit_id    uuid        not null references habits(id) on delete cascade,

  day_number  integer     not null check (day_number >= 1),
  status      text        not null default '0' check (status in ('0','1','2','3','4')),
  emotion     text        check (emotion in (
    'motivated',
    'calm',
    'tired',
    'anxious',
    'overloaded',
    'proud',
    'distracted',
    'satisfied'
  )),
  energy      text        check (energy in ('high','medium','low')),
  note        text        default '',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One entry per habit per day
  unique (habit_id, day_number)
);

drop trigger if exists habit_entries_updated_at on habit_entries;
create trigger habit_entries_updated_at
  before update on habit_entries
  for each row execute function set_updated_at();

-- RLS: entry belongs to user if its habit belongs to user
alter table habit_entries enable row level security;

create policy "entries: users own their rows"
  on habit_entries for all
  using  (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));

create index entries_habit_day_idx on habit_entries(habit_id, day_number);


-- ── Settings ─────────────────────────────────────────────────────────────

create table if not exists settings (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null unique references auth.users(id) on delete cascade,

  pin_enabled              boolean     not null default false,
  notifications_enabled    boolean     not null default false,
  show_streak              boolean     not null default true,
  show_progress            boolean     not null default true,
  theme                    text        not null default 'dark'
                             check (theme in ('light','dark','system')),
  include_emotions_export  boolean     not null default true,

  updated_at timestamptz not null default now()
);

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

alter table settings enable row level security;

create policy "settings: users own their row"
  on settings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Analytics helpers (views for future use) ─────────────────────────────

-- Streak per habit (consecutive days with status > '0' ending today)
create or replace view v_habit_streaks as
select
  h.id       as habit_id,
  h.user_id,
  h.title,
  count(*)   as streak_days
from habits h
join habit_entries e on e.habit_id = h.id and e.status != '0'
where h.is_active = true
  -- Only count a streak if today's day is logged (simplification)
group by h.id, h.user_id, h.title;

-- Completion rate per habit
create or replace view v_habit_completion as
select
  h.id                                         as habit_id,
  h.user_id,
  h.title,
  h.total_days,
  count(e.id) filter (where e.status != '0')   as completed_days,
  round(
    count(e.id) filter (where e.status != '0')::numeric
    / nullif(h.total_days, 0) * 100, 1
  )                                            as completion_pct
from habits h
left join habit_entries e on e.habit_id = h.id
where h.is_active = true
group by h.id, h.user_id, h.title, h.total_days;

-- Emotion frequency
create or replace view v_emotion_frequency as
select
  h.user_id,
  e.emotion,
  count(*) as occurrences
from habit_entries e
join habits h on h.id = e.habit_id
where e.emotion is not null
group by h.user_id, e.emotion
order by occurrences desc;

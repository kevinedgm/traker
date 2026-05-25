-- ════════════════════════════════════════════════════════════════════
-- Traker — Phase 7 sync fields
-- Adds ADHD-first entry states and emotional/energy metadata to
-- existing Supabase projects created from 001_initial_schema.sql.
-- ════════════════════════════════════════════════════════════════════

alter table habit_entries
  add column if not exists energy text,
  add column if not exists updated_at timestamptz not null default now();

alter table habits
  add column if not exists updated_at timestamptz not null default now();

alter table habit_entries
  drop constraint if exists habit_entries_status_check,
  add constraint habit_entries_status_check
    check (status in ('0','1','2','3','4'));

alter table habit_entries
  drop constraint if exists habit_entries_emotion_check,
  add constraint habit_entries_emotion_check
    check (
      emotion is null or emotion in (
        'motivated',
        'calm',
        'tired',
        'anxious',
        'overloaded',
        'proud',
        'distracted',
        'satisfied'
      )
    );

alter table habit_entries
  drop constraint if exists habit_entries_energy_check,
  add constraint habit_entries_energy_check
    check (energy is null or energy in ('high','medium','low'));

drop trigger if exists habits_updated_at on habits;
create trigger habits_updated_at
  before update on habits
  for each row execute function set_updated_at();

drop trigger if exists habit_entries_updated_at on habit_entries;
create trigger habit_entries_updated_at
  before update on habit_entries
  for each row execute function set_updated_at();

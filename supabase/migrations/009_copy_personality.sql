-- Traker — copy/personality system.
-- Additive and safe for existing rows: both columns are nullable with a
-- sensible default, no data loss, no renames.
--
--   habits.copy_settings — per-habit override (category, toneOverride,
--     carrillaEnabled, customPhrases, preferCustomPhrases, disabledEventIds).
--     Client-only concept, stored opaquely; the cron never reads
--     customPhrases from here (notification copy now uses the shared,
--     versioned contract in supabase/functions/_shared/notification-planner.js).
--
--   settings.tone — the global tone ('normal' | 'trusted' | 'no_respect').
--     Needed server-side because send-reminders picks its own copy pool
--     by this value.

alter table habits
  add column if not exists copy_settings jsonb;

alter table settings
  add column if not exists tone text not null default 'no_respect';

alter table settings
  drop constraint if exists settings_tone_check,
  add constraint settings_tone_check
    check (tone in ('normal', 'trusted', 'no_respect'));

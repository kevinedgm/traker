-- Manual Phase 5 rollback. Run only after disabling VITE_SYNC_V2_PILOT.
-- Legacy tables/readers are not touched and remain the source of truth.

drop function if exists public.traker_pull_sync_changes(text, timestamptz, uuid, integer);
drop function if exists public.traker_apply_sync_operations(text, jsonb);
drop function if exists public.traker_backfill_quality();
drop function if exists public.traker_backfill_legacy(uuid);

drop index if exists public.traker_sync_operations_pull_idx;
drop index if exists public.traker_habit_schedules_backfill_unique;
drop index if exists public.traker_habit_logs_legacy_entry_unique;

-- Canonical rows produced by the backfill are intentionally preserved. Their
-- provenance columns are also retained to avoid destroying auditability. A
-- later, explicitly approved cleanup can remove them after the pilot decision.

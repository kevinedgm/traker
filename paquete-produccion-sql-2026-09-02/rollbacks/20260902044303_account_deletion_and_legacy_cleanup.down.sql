drop function if exists public.traker_account_deletion_state(uuid, uuid);
drop function if exists traker_private.account_deletion_state(uuid, uuid);

create schema if not exists traker_phase6_rollback;
revoke all on schema traker_phase6_rollback from public, anon, authenticated, service_role;

-- The removed rollback schema was empty when this migration was applied.
-- Reversal restores only the private namespace, never synthetic data.

-- Extend the server-only deletion verifier for the new analytics ledger without
-- rewriting the previously applied account-deletion migration.

create or replace function traker_private.account_deletion_state_with_analytics(
  p_user_id uuid,
  p_session_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_set(
    state,
    '{ownedRows}',
    to_jsonb(
      coalesce((state->>'ownedRows')::bigint, 0)
      + (select count(*) from public.traker_product_events where user_id = p_user_id)
    )
  )
  from traker_private.account_deletion_state(p_user_id, p_session_id) state;
$$;

revoke all on function traker_private.account_deletion_state_with_analytics(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function traker_private.account_deletion_state_with_analytics(uuid, uuid)
  to service_role;

create or replace function public.traker_account_deletion_state(
  p_user_id uuid,
  p_session_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select traker_private.account_deletion_state_with_analytics(p_user_id, p_session_id);
$$;

revoke all on function public.traker_account_deletion_state(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.traker_account_deletion_state(uuid, uuid)
  to service_role;


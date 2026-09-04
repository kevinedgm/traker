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
  select traker_private.account_deletion_state(p_user_id, p_session_id);
$$;

revoke all on function public.traker_account_deletion_state(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.traker_account_deletion_state(uuid, uuid)
  to service_role;

drop function if exists traker_private.account_deletion_state_with_analytics(uuid, uuid);


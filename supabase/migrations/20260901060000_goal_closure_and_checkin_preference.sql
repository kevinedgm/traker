-- Preserve conscious goal closure metadata through the existing outbox RPC,
-- and keep the explicit daily check-in preference in the account settings row.

alter table public.settings
  add column if not exists daily_checkin_prompt text not null default 'ask';

alter table public.settings
  drop constraint if exists settings_daily_checkin_prompt_check;
alter table public.settings
  add constraint settings_daily_checkin_prompt_check
  check (daily_checkin_prompt in ('ask', 'never'));

alter function public.sync_traker_goal_operations(jsonb)
  rename to sync_traker_goal_operations_v1;

create function public.sync_traker_goal_operations(p_operations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_operation jsonb;
  v_payload jsonb;
begin
  v_result := public.sync_traker_goal_operations_v1(p_operations);

  for v_operation in select value from jsonb_array_elements(p_operations)
  loop
    if v_operation->>'entityType' <> 'goal' then
      continue;
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(v_result->'results', '[]'::jsonb)) as result(value)
      where result.value->>'operationId' = v_operation->>'operationId'
        and result.value->>'status' = 'applied'
    ) then
      continue;
    end if;

    v_payload := v_operation->'payload';
    update public.traker_goals
    set
      close_reason = case
        when v_payload ? 'closeReason' then nullif(v_payload->>'closeReason', '')
        else close_reason
      end,
      successor_goal_id = case
        when v_payload ? 'successorGoalId' then nullif(v_payload->>'successorGoalId', '')::uuid
        else successor_goal_id
      end
    where id = (v_operation->>'entityId')::uuid
      and user_id = auth.uid();
  end loop;

  return v_result;
end;
$$;

revoke all on function public.sync_traker_goal_operations(jsonb) from public;
grant execute on function public.sync_traker_goal_operations(jsonb) to authenticated;

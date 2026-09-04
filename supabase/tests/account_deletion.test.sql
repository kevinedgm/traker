begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

select has_function(
  'public',
  'traker_account_deletion_state',
  array['uuid', 'uuid'],
  'server-only account deletion state RPC exists'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.traker_account_deletion_state(uuid,uuid)'::regprocedure),
  'the public wrapper is security invoker'
);
select ok(
  not has_function_privilege('anon', 'public.traker_account_deletion_state(uuid,uuid)', 'execute'),
  'anonymous clients cannot inspect deletion state'
);
select ok(
  not has_function_privilege('authenticated', 'public.traker_account_deletion_state(uuid,uuid)', 'execute'),
  'authenticated browsers cannot inspect global deletion state'
);
select ok(
  has_function_privilege('service_role', 'public.traker_account_deletion_state(uuid,uuid)', 'execute'),
  'the Edge Function service role can inspect deletion state'
);
select ok(
  (select prosecdef from pg_proc where oid = 'traker_private.account_deletion_state(uuid,uuid)'::regprocedure),
  'the private Auth-session reader is security definer'
);
select ok(
  exists (
    select 1
    from unnest((select proconfig from pg_proc where oid = 'traker_private.account_deletion_state(uuid,uuid)'::regprocedure)) setting
    where setting = 'search_path=""'
  ),
  'the private privileged function pins an empty search path'
);
select hasnt_schema('traker_phase6_rollback', 'the empty legacy rollback schema is removed');

insert into auth.users (id, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'delete-a@traker.local'),
  ('b1000000-0000-4000-8000-000000000002', 'delete-b@traker.local');

insert into public.habits (id, user_id, title, total_days)
values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Cuenta A', 30),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Cuenta B', 30);

set local role service_role;
select is(
  (public.traker_account_deletion_state(
    'a1000000-0000-4000-8000-000000000001', null
  )->>'ownedRows')::integer,
  1,
  'preflight counts only account A rows'
);

reset role;
delete from auth.users where id = 'a1000000-0000-4000-8000-000000000001';

set local role service_role;
select is(
  (public.traker_account_deletion_state(
    'a1000000-0000-4000-8000-000000000001', null
  )->>'ownedRows')::integer,
  0,
  'hard delete leaves no owner-scoped rows for account A'
);

reset role;
select is(
  (select count(*)::integer from public.habits where user_id = 'b1000000-0000-4000-8000-000000000002'),
  1,
  'account B remains intact after deleting account A'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  0,
  'every public application table has RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and (
        has_table_privilege('anon', c.oid, 'select')
        or has_table_privilege('anon', c.oid, 'insert')
        or has_table_privilege('anon', c.oid, 'update')
        or has_table_privilege('anon', c.oid, 'delete')
      )
  ),
  0,
  'anonymous clients have no application-table privileges'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not (coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true'])
      and (
        has_table_privilege('anon', c.oid, 'select')
        or has_table_privilege('authenticated', c.oid, 'select')
      )
  ),
  0,
  'no client-visible public view bypasses underlying RLS'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  0,
  'anonymous clients cannot execute public security-definer functions'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.oid <> 'public.traker_apply_sync_operations(text,jsonb)'::regprocedure
  ),
  0,
  'authenticated clients only reach the allowlisted security-definer RPC'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      )
  ),
  0,
  'every public security-definer function pins its search path'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'sent_reminders'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  0,
  'sent_reminders is intentionally server-only despite having no client policy'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.role%'
        or coalesce(with_check, '') like '%auth.role%'
      )
  ),
  0,
  'public policies do not use the deprecated auth.role helper'
);

select * from finish();
rollback;

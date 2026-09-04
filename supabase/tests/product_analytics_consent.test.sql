begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

select has_table('public', 'traker_product_events', 'content-free product event ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.traker_product_events'::regclass),
  'product events have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.traker_product_events', 'select'), 'anonymous clients cannot read product events');
select ok(not has_table_privilege('anon', 'public.traker_product_events', 'insert'), 'anonymous clients cannot emit product events');
select ok(has_table_privilege('authenticated', 'public.traker_product_events', 'insert'), 'authenticated clients may emit through RLS');
select ok(not has_table_privilege('authenticated', 'public.traker_product_events', 'update'), 'product events are immutable from the browser');

insert into auth.users (id, email)
values
  ('a5000000-0000-4000-8000-000000000001', 'analytics-a@traker.local'),
  ('b5000000-0000-4000-8000-000000000002', 'analytics-b@traker.local');

insert into public.traker_product_consents (user_id, purpose, consent_version, granted_at)
values ('a5000000-0000-4000-8000-000000000001', 'goals_analytics', 'goals-analytics-v1', now());

set local role authenticated;
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000001';

insert into public.traker_product_events (user_id, event_type, duration_bucket)
values ('a5000000-0000-4000-8000-000000000001', 'activation', 'under_10s');

select is(
  (select count(*)::integer from public.traker_product_events),
  1,
  'active consent allows one content-free event'
);

reset role;
set local role service_role;
select is(
  (public.traker_account_deletion_state('a5000000-0000-4000-8000-000000000001', null)->>'ownedRows')::integer,
  2,
  'account deletion verification includes consent and product events'
);
set local role authenticated;
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000001';

select throws_ok(
  $$insert into public.traker_product_events (user_id, event_type)
    values ('b5000000-0000-4000-8000-000000000002', 'return')$$,
  '42501',
  null,
  'RLS prevents emitting an event for another account'
);

select throws_ok(
  $$insert into public.traker_product_events (user_id, event_type)
    values ('a5000000-0000-4000-8000-000000000001', 'free_text_event')$$,
  '23514',
  null,
  'arbitrary event names are rejected'
);

reset role;
update public.traker_product_consents
set revoked_at = now()
where user_id = 'a5000000-0000-4000-8000-000000000001'
  and purpose = 'goals_analytics';

set local role authenticated;
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000001';

select throws_ok(
  $$insert into public.traker_product_events (user_id, event_type)
    values ('a5000000-0000-4000-8000-000000000001', 'habit_log')$$,
  '42501',
  null,
  'revoked consent blocks every new event at the database boundary'
);

select is(
  (select count(*)::integer from public.traker_product_events),
  1,
  'revocation preserves prior audit evidence without adding events'
);

delete from public.traker_product_events;
select is((select count(*)::integer from public.traker_product_events), 0, 'the owner can erase prior analytics events');

reset role;
select is(
  (select count(*)::integer from public.traker_product_events where user_id = 'b5000000-0000-4000-8000-000000000002'),
  0,
  'the cross-user attempt created no data'
);

select * from finish();
rollback;

-- Traker integrated personal model.
--
-- This migration keeps the legacy tables used by the current client while
-- adding the canonical goal/habit/schedule/check-in/reward/notification model.
-- It is intentionally additive so the client can move domain by domain.

-- ---------------------------------------------------------------------------
-- 1. Harden legacy objects and normalize constraints
-- ---------------------------------------------------------------------------

alter function public.set_updated_at() set search_path = pg_catalog, public;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter function public.sync_traker_goal_operations(jsonb)
  set search_path = pg_catalog, public;
revoke all on function public.sync_traker_goal_operations(jsonb) from public, anon;
grant execute on function public.sync_traker_goal_operations(jsonb) to authenticated;

alter view public.v_habit_streaks set (security_invoker = true);
alter view public.v_habit_completion set (security_invoker = true);
alter view public.v_emotion_frequency set (security_invoker = true);

revoke all on public.v_habit_streaks from public, anon;
revoke all on public.v_habit_completion from public, anon;
revoke all on public.v_emotion_frequency from public, anon;
grant select on public.v_habit_streaks to authenticated;
grant select on public.v_habit_completion to authenticated;
grant select on public.v_emotion_frequency to authenticated;

alter table public.habits
  drop constraint if exists habits_reminder_time_check;
alter table public.habits
  add constraint habits_reminder_time_check
  check (
    reminder_time is null
    or reminder_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
  );

alter table public.habits
  add constraint habits_reminder_days_check
  check (
    reminder_days is null
    or (
      cardinality(reminder_days) between 1 and 7
      and reminder_days <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  );

alter table public.settings
  drop constraint if exists settings_morning_time_check;
alter table public.settings
  add constraint settings_morning_time_check
  check (morning_reminder_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

alter table public.settings
  drop constraint if exists settings_inactivity_time_check;
alter table public.settings
  add constraint settings_inactivity_time_check
  check (inactivity_reminder_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

alter table public.traker_goals
  drop constraint if exists traker_goals_status_check;
alter table public.traker_goals
  add constraint traker_goals_status_check
  check (status in (
    'draft', 'active', 'paused', 'completed', 'closed',
    'reformulated', 'abandoned', 'archived'
  ));

alter table public.traker_goals
  drop constraint if exists traker_goals_focus_rank_check;
alter table public.traker_goals
  add constraint traker_goals_focus_rank_check
  check (focus_rank is null or focus_rank between 0 and 2);

alter table public.traker_goal_actions
  add constraint traker_goal_actions_estimate_bucket_check
  check (
    estimate_bucket is null
    or estimate_bucket in ('5m', '15m', '30m', '60m', 'open')
  );

-- ---------------------------------------------------------------------------
-- 2. Extend goals and enforce aggregate integrity
-- ---------------------------------------------------------------------------

alter table public.traker_goals
  add column if not exists target_date date,
  add column if not exists close_reason text,
  add column if not exists successor_goal_id uuid;

alter table public.traker_goals
  add constraint traker_goals_id_user_unique unique (id, user_id);

alter table public.traker_goals
  drop constraint if exists traker_goals_reformulated_from_goal_id_fkey;
alter table public.traker_goals
  add constraint traker_goals_reformulated_same_user_fk
  foreign key (reformulated_from_goal_id, user_id)
  references public.traker_goals(id, user_id)
  deferrable initially deferred;

alter table public.traker_goals
  add constraint traker_goals_successor_same_user_fk
  foreign key (successor_goal_id, user_id)
  references public.traker_goals(id, user_id)
  deferrable initially deferred;

alter table public.traker_goal_actions
  add constraint traker_goal_actions_goal_id_id_unique unique (goal_id, id);

alter table public.traker_goals
  drop constraint if exists traker_goals_current_action_fk;
alter table public.traker_goals
  add constraint traker_goals_current_action_same_goal_fk
  foreign key (id, current_action_id)
  references public.traker_goal_actions(goal_id, id)
  deferrable initially deferred;

create table public.traker_goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  title varchar(160) not null check (char_length(title) between 1 and 160),
  done_definition text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'skipped')),
  position integer not null default 0 check (position >= 0),
  target_date date,
  completed_at timestamptz,
  evidence_summary text not null default '',
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_goal_milestones_goal_owner_fk
    foreign key (goal_id, user_id)
    references public.traker_goals(id, user_id)
    on delete cascade,
  constraint traker_goal_milestones_completion_check
    check (
      (status = 'completed' and completed_at is not null)
      or status <> 'completed'
    ),
  constraint traker_goal_milestones_goal_id_id_unique unique (goal_id, id),
  constraint traker_goal_milestones_id_user_unique unique (id, user_id)
);

alter table public.traker_goal_actions
  add column if not exists milestone_id uuid,
  add column if not exists scheduled_local_date date;

alter table public.traker_goal_actions
  add constraint traker_goal_actions_milestone_same_goal_fk
  foreign key (goal_id, milestone_id)
  references public.traker_goal_milestones(goal_id, id)
  deferrable initially deferred;

alter table public.traker_work_sessions
  add column if not exists user_id uuid;

update public.traker_work_sessions s
set user_id = g.user_id
from public.traker_goals g
where g.id = s.goal_id and s.user_id is null;

alter table public.traker_work_sessions
  alter column user_id set not null,
  add constraint traker_work_sessions_user_fk
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint traker_work_sessions_goal_owner_fk
    foreign key (goal_id, user_id)
    references public.traker_goals(id, user_id)
    on delete cascade,
  add constraint traker_work_sessions_id_user_unique unique (id, user_id);

create function public.set_traker_work_session_owner()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  select g.user_id
  into new.user_id
  from public.traker_goals g
  where g.id = new.goal_id;

  if new.user_id is null then
    raise exception 'WORK_SESSION_GOAL_NOT_FOUND' using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.set_traker_work_session_owner()
  from public, anon, authenticated;

create trigger traker_work_sessions_set_owner
  before insert or update of goal_id on public.traker_work_sessions
  for each row execute function public.set_traker_work_session_owner();

create unique index traker_one_running_session_per_user
  on public.traker_work_sessions(user_id)
  where status = 'running';

-- ---------------------------------------------------------------------------
-- 3. Habits, many-to-many links, schedules, flexible groups and v2 logs
-- ---------------------------------------------------------------------------

alter table public.habits
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists target_version varchar(160) not null default '',
  add column if not exists extra_version varchar(160) not null default '',
  add column if not exists timezone text not null default 'America/Mexico_City',
  add column if not exists paused_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists version integer not null default 1;

alter table public.habits
  add constraint habits_lifecycle_status_check
    check (lifecycle_status in ('active', 'paused', 'archived')),
  add constraint habits_version_check check (version >= 1),
  add constraint habits_id_user_unique unique (id, user_id);

create table public.traker_habit_goal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  goal_id uuid not null,
  contribution_note text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_habit_goal_links_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits(id, user_id)
    on delete cascade,
  constraint traker_habit_goal_links_goal_owner_fk
    foreign key (goal_id, user_id)
    references public.traker_goals(id, user_id)
    on delete cascade
);

create unique index traker_habit_goal_links_active_unique
  on public.traker_habit_goal_links(user_id, habit_id, goal_id)
  where deleted_at is null;

-- Preserve valid legacy one-to-one links as the first N:M relationship.
insert into public.traker_habit_goal_links (user_id, habit_id, goal_id)
select h.user_id, h.id, h.linked_goal_id
from public.habits h
join public.traker_goals g
  on g.id = h.linked_goal_id and g.user_id = h.user_id
where h.linked_goal_id is not null
on conflict (user_id, habit_id, goal_id) where deleted_at is null do nothing;

create table public.traker_habit_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  kind text not null
    check (kind in ('weekdays', 'times_per_week', 'times_per_month', 'every_n_days', 'window')),
  timezone text not null default 'America/Mexico_City',
  effective_from date not null default current_date,
  effective_to date,
  days_of_week smallint[],
  interval_days smallint,
  period_minimum smallint,
  period_target smallint,
  period_extra smallint,
  window_start time,
  window_end time,
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_habit_schedules_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits(id, user_id)
    on delete cascade,
  constraint traker_habit_schedules_dates_check
    check (effective_to is null or effective_to >= effective_from),
  constraint traker_habit_schedules_days_check
    check (
      days_of_week is null
      or (
        cardinality(days_of_week) between 1 and 7
        and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
      )
    ),
  constraint traker_habit_schedules_interval_check
    check (interval_days is null or interval_days between 1 and 366),
  constraint traker_habit_schedules_targets_check
    check (
      (period_minimum is null or period_minimum >= 0)
      and (period_target is null or period_target >= 0)
      and (period_extra is null or period_extra >= 0)
      and (period_minimum is null or period_target is null or period_minimum <= period_target)
      and (period_target is null or period_extra is null or period_target <= period_extra)
    ),
  constraint traker_habit_schedules_kind_payload_check
    check (
      (kind = 'weekdays' and days_of_week is not null)
      or (kind = 'times_per_week' and period_minimum is not null)
      or (kind = 'times_per_month' and period_minimum is not null)
      or (kind = 'every_n_days' and interval_days is not null)
      or kind = 'window'
    ),
  constraint traker_habit_schedules_id_user_unique unique (id, user_id)
);

create table public.traker_flexible_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name varchar(120) not null check (char_length(name) between 1 and 120),
  period text not null default 'week' check (period in ('week', 'month')),
  minimum_count smallint not null default 1 check (minimum_count >= 0),
  target_count smallint check (target_count is null or target_count >= 0),
  extra_count smallint check (extra_count is null or extra_count >= 0),
  timezone text not null default 'America/Mexico_City',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_flexible_groups_targets_check
    check (
      (target_count is null or minimum_count <= target_count)
      and (target_count is null or extra_count is null or target_count <= extra_count)
    ),
  constraint traker_flexible_groups_id_user_unique unique (id, user_id)
);

create table public.traker_flexible_group_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null,
  habit_id uuid not null,
  position integer not null default 0 check (position >= 0),
  active_from date not null default current_date,
  active_until date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_flexible_group_members_group_owner_fk
    foreign key (group_id, user_id)
    references public.traker_flexible_groups(id, user_id)
    on delete cascade,
  constraint traker_flexible_group_members_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits(id, user_id)
    on delete cascade,
  constraint traker_flexible_group_members_dates_check
    check (active_until is null or active_until >= active_from)
);

create unique index traker_flexible_group_members_active_unique
  on public.traker_flexible_group_members(user_id, group_id, habit_id)
  where deleted_at is null;

create table public.traker_habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  local_date date not null,
  timezone text not null default 'America/Mexico_City',
  occurrence_key varchar(160) not null,
  status text not null check (status in ('done', 'partial', 'not_done', 'conscious_skip')),
  minimum_used boolean not null default false,
  quantity numeric check (quantity is null or quantity >= 0),
  unit varchar(40),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  context_codes text[],
  note text not null default '',
  occurred_at timestamptz not null default now(),
  client_operation_id uuid not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  legacy_entry_id uuid references public.habit_entries(id) on delete set null,
  constraint traker_habit_logs_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits(id, user_id)
    on delete cascade,
  constraint traker_habit_logs_operation_unique unique (user_id, client_operation_id),
  constraint traker_habit_logs_id_user_unique unique (id, user_id)
);

create unique index traker_habit_logs_occurrence_active_unique
  on public.traker_habit_logs(user_id, habit_id, occurrence_key)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Optional daily context
-- ---------------------------------------------------------------------------

create table public.traker_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null default 'America/Mexico_City',
  energy smallint check (energy is null or energy between 1 and 5),
  mood smallint check (mood is null or mood between 1 and 5),
  pressure smallint check (pressure is null or pressure between 1 and 5),
  load_feeling text check (load_feeling is null or load_feeling in ('light', 'okay', 'heavy')),
  context_codes text[],
  note text not null default '',
  client_operation_id uuid not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_daily_checkins_operation_unique unique (user_id, client_operation_id)
);

create unique index traker_daily_checkins_active_date_unique
  on public.traker_daily_checkins(user_id, local_date)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 5. Rewards without chance-based mechanics
-- ---------------------------------------------------------------------------

create table public.traker_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name varchar(120) not null check (char_length(name) between 1 and 120),
  description text not null default '',
  safety_note text not null default '',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_rewards_id_user_unique unique (id, user_id)
);

create table public.traker_reward_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null,
  rule_type text not null check (rule_type in ('all', 'at_least', 'milestone', 'day_sufficient')),
  threshold smallint
    constraint traker_reward_rules_threshold_positive_check
    check (threshold is null or threshold > 0),
  period text not null default 'week' check (period in ('instant', 'day', 'week', 'month', 'once')),
  active_from date not null default current_date,
  active_until date,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_reward_rules_reward_owner_fk
    foreign key (reward_id, user_id)
    references public.traker_rewards(id, user_id)
    on delete cascade,
  constraint traker_reward_rules_dates_check
    check (active_until is null or active_until >= active_from),
  constraint traker_reward_rules_threshold_required_check
    check ((rule_type = 'at_least' and threshold is not null) or rule_type <> 'at_least'),
  constraint traker_reward_rules_id_user_unique unique (id, user_id)
);

create table public.traker_reward_rule_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null,
  habit_id uuid,
  flexible_group_id uuid,
  milestone_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint traker_reward_rule_sources_rule_owner_fk
    foreign key (rule_id, user_id)
    references public.traker_reward_rules(id, user_id)
    on delete cascade,
  constraint traker_reward_rule_sources_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits(id, user_id)
    on delete cascade,
  constraint traker_reward_rule_sources_group_owner_fk
    foreign key (flexible_group_id, user_id)
    references public.traker_flexible_groups(id, user_id)
    on delete cascade,
  constraint traker_reward_rule_sources_milestone_owner_fk
    foreign key (milestone_id, user_id)
    references public.traker_goal_milestones(id, user_id)
    on delete cascade,
  constraint traker_reward_rule_sources_exactly_one_check
    check (num_nonnulls(habit_id, flexible_group_id, milestone_id) = 1)
);

create unique index traker_reward_rule_sources_habit_unique
  on public.traker_reward_rule_sources(user_id, rule_id, habit_id)
  where habit_id is not null and deleted_at is null;
create unique index traker_reward_rule_sources_group_unique
  on public.traker_reward_rule_sources(user_id, rule_id, flexible_group_id)
  where flexible_group_id is not null and deleted_at is null;
create unique index traker_reward_rule_sources_milestone_unique
  on public.traker_reward_rule_sources(user_id, rule_id, milestone_id)
  where milestone_id is not null and deleted_at is null;

create table public.traker_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null,
  period_key varchar(80) not null,
  unlocked_at timestamptz not null,
  claimed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint traker_reward_claims_rule_owner_fk
    foreign key (rule_id, user_id)
    references public.traker_reward_rules(id, user_id)
    on delete cascade,
  constraint traker_reward_claims_times_check
    check (
      (claimed_at is null or claimed_at >= unlocked_at)
      and (used_at is null or claimed_at is not null)
      and (used_at is null or used_at >= claimed_at)
    ),
  constraint traker_reward_claims_period_unique unique (user_id, rule_id, period_key)
);

-- ---------------------------------------------------------------------------
-- 6. Notification preferences, durable jobs and delivery attempts
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions
  add column if not exists device_id text,
  add column if not exists last_success_at timestamptz,
  add column if not exists failure_count integer not null default 0,
  add column if not exists invalidated_at timestamptz,
  add column if not exists capabilities jsonb not null default '{}'::jsonb;

alter table public.push_subscriptions
  add constraint push_subscriptions_failure_count_check check (failure_count >= 0),
  add constraint push_subscriptions_id_user_unique unique (id, user_id);

create table public.traker_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text,
  morning_enabled boolean not null default true,
  habit_enabled boolean not null default true,
  closing_enabled boolean not null default true,
  return_enabled boolean not null default true,
  morning_time time not null default '08:00',
  closing_time time not null default '20:30',
  quiet_start time not null default '21:30',
  quiet_end time not null default '07:30',
  timezone text not null default 'America/Mexico_City',
  daily_budget smallint not null default 2 check (daily_budget between 0 and 6),
  lock_screen_privacy text not null default 'generic'
    check (lock_screen_privacy in ('generic', 'names_allowed')),
  direct_actions_enabled boolean not null default false,
  silenced_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traker_notification_preferences_scope_unique unique (user_id, device_id)
);

-- Postgres unique constraints allow multiple nulls. This partial index enforces
-- a single global preference row per user while device rows use the constraint.
create unique index traker_notification_preferences_global_unique
  on public.traker_notification_preferences(user_id)
  where device_id is null;

create table public.traker_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_key varchar(200) not null,
  kind text not null check (kind in ('morning_opening', 'habit_or_block', 'evening_close', 'return_nudge')),
  target_ref uuid,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'suppressed', 'completed', 'expired')),
  lease_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  suppression_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traker_notification_jobs_window_check check (expires_at > scheduled_at),
  constraint traker_notification_jobs_user_key_unique unique (user_id, job_key),
  constraint traker_notification_jobs_id_user_unique unique (id, user_id)
);

create table public.traker_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  subscription_id uuid not null,
  attempt integer not null default 1 check (attempt > 0),
  status text not null default 'sending'
    check (status in ('sending', 'delivered', 'failed', 'invalid_subscription')),
  provider_status integer,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint traker_notification_deliveries_job_owner_fk
    foreign key (job_id, user_id)
    references public.traker_notification_jobs(id, user_id)
    on delete cascade,
  constraint traker_notification_deliveries_subscription_owner_fk
    foreign key (subscription_id, user_id)
    references public.push_subscriptions(id, user_id)
    on delete cascade,
  constraint traker_notification_deliveries_attempt_unique
    unique (job_id, subscription_id, attempt)
);

-- ---------------------------------------------------------------------------
-- 7. General sync ledger and device cursors
-- ---------------------------------------------------------------------------

alter table public.traker_product_consents
  drop constraint if exists traker_product_consents_purpose_check;
alter table public.traker_product_consents
  add constraint traker_product_consents_purpose_check
  check (purpose in (
    'goals_sync', 'goals_analytics', 'personal_data_sync',
    'checkins_sync', 'product_analytics'
  ));

create table public.traker_sync_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type varchar(80) not null,
  entity_id uuid not null,
  operation_type text not null check (operation_type in ('upsert', 'delete', 'restore')),
  base_version integer not null default 0 check (base_version >= 0),
  new_version integer check (new_version is null or new_version >= 1),
  payload jsonb not null default '{}'::jsonb,
  device_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  result text not null default 'pending'
    check (result in ('pending', 'applied', 'duplicate', 'conflict', 'rejected')),
  conflict jsonb,
  constraint traker_sync_operations_user_operation_unique unique (user_id, operation_id)
);

create table public.traker_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  last_received_at timestamptz,
  last_operation_id uuid,
  updated_at timestamptz not null default now(),
  constraint traker_sync_cursors_device_unique unique (user_id, device_id)
);

-- ---------------------------------------------------------------------------
-- 8. Indexes
-- ---------------------------------------------------------------------------

create index traker_goal_milestones_goal_position_idx
  on public.traker_goal_milestones(goal_id, position)
  where deleted_at is null;
create index traker_goal_actions_milestone_idx
  on public.traker_goal_actions(milestone_id)
  where milestone_id is not null and deleted_at is null;
create index traker_work_sessions_user_started_idx
  on public.traker_work_sessions(user_id, started_at desc);
create index traker_habit_goal_links_goal_idx
  on public.traker_habit_goal_links(goal_id, habit_id)
  where deleted_at is null;
create index traker_habit_goal_links_habit_idx
  on public.traker_habit_goal_links(habit_id, goal_id)
  where deleted_at is null;
create index traker_habit_schedules_active_idx
  on public.traker_habit_schedules(user_id, habit_id, effective_from, effective_to)
  where is_active and deleted_at is null;
create index traker_flexible_group_members_group_idx
  on public.traker_flexible_group_members(group_id, position)
  where deleted_at is null;
create index traker_flexible_group_members_habit_idx
  on public.traker_flexible_group_members(habit_id)
  where deleted_at is null;
create index traker_habit_logs_user_date_idx
  on public.traker_habit_logs(user_id, local_date desc)
  where deleted_at is null;
create index traker_habit_logs_habit_date_idx
  on public.traker_habit_logs(habit_id, local_date desc)
  where deleted_at is null;
create index traker_daily_checkins_user_date_idx
  on public.traker_daily_checkins(user_id, local_date desc)
  where deleted_at is null;
create index traker_reward_rules_reward_idx
  on public.traker_reward_rules(reward_id)
  where deleted_at is null;
create index traker_reward_rule_sources_rule_idx
  on public.traker_reward_rule_sources(rule_id)
  where deleted_at is null;
create index traker_reward_claims_rule_time_idx
  on public.traker_reward_claims(rule_id, unlocked_at desc);
create index traker_notification_jobs_queue_idx
  on public.traker_notification_jobs(next_attempt_at, scheduled_at)
  where status = 'queued';
create index traker_notification_jobs_user_schedule_idx
  on public.traker_notification_jobs(user_id, scheduled_at desc);
create index traker_notification_deliveries_job_idx
  on public.traker_notification_deliveries(job_id, created_at desc);
create index traker_notification_deliveries_subscription_idx
  on public.traker_notification_deliveries(subscription_id, created_at desc);
create index traker_sync_operations_user_received_idx
  on public.traker_sync_operations(user_id, received_at, operation_id);

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------------------------

create trigger traker_goal_milestones_updated_at
  before update on public.traker_goal_milestones
  for each row execute function public.set_updated_at();
create trigger traker_habit_schedules_updated_at
  before update on public.traker_habit_schedules
  for each row execute function public.set_updated_at();
create trigger traker_flexible_groups_updated_at
  before update on public.traker_flexible_groups
  for each row execute function public.set_updated_at();
create trigger traker_habit_logs_updated_at
  before update on public.traker_habit_logs
  for each row execute function public.set_updated_at();
create trigger traker_daily_checkins_updated_at
  before update on public.traker_daily_checkins
  for each row execute function public.set_updated_at();
create trigger traker_rewards_updated_at
  before update on public.traker_rewards
  for each row execute function public.set_updated_at();
create trigger traker_reward_rules_updated_at
  before update on public.traker_reward_rules
  for each row execute function public.set_updated_at();
create trigger traker_notification_preferences_updated_at
  before update on public.traker_notification_preferences
  for each row execute function public.set_updated_at();
create trigger traker_notification_jobs_updated_at
  before update on public.traker_notification_jobs
  for each row execute function public.set_updated_at();
create trigger traker_sync_cursors_updated_at
  before update on public.traker_sync_cursors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. RLS, policies and explicit Data API grants
-- ---------------------------------------------------------------------------

alter table public.traker_goal_milestones enable row level security;
alter table public.traker_habit_goal_links enable row level security;
alter table public.traker_habit_schedules enable row level security;
alter table public.traker_flexible_groups enable row level security;
alter table public.traker_flexible_group_members enable row level security;
alter table public.traker_habit_logs enable row level security;
alter table public.traker_daily_checkins enable row level security;
alter table public.traker_rewards enable row level security;
alter table public.traker_reward_rules enable row level security;
alter table public.traker_reward_rule_sources enable row level security;
alter table public.traker_reward_claims enable row level security;
alter table public.traker_notification_preferences enable row level security;
alter table public.traker_notification_jobs enable row level security;
alter table public.traker_notification_deliveries enable row level security;
alter table public.traker_sync_operations enable row level security;
alter table public.traker_sync_cursors enable row level security;

-- Replace legacy broad policies with role-scoped, initPlan-friendly policies.
drop policy if exists "habits: users own their rows" on public.habits;
create policy habits_owner_all on public.habits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "entries: users own their rows" on public.habit_entries;
create policy habit_entries_owner_all on public.habit_entries
  for all to authenticated
  using (exists (
    select 1 from public.habits h
    where h.id = habit_id and h.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.habits h
    where h.id = habit_id and h.user_id = (select auth.uid())
  ));

drop policy if exists "settings: users own their row" on public.settings;
create policy settings_owner_all on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_subscriptions: users own their rows" on public.push_subscriptions;
create policy push_subscriptions_owner_all on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "goals: users own their rows" on public.traker_goals;
create policy traker_goals_owner_all on public.traker_goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "goal actions: users own through goal" on public.traker_goal_actions;
create policy traker_goal_actions_owner_all on public.traker_goal_actions
  for all to authenticated
  using (exists (
    select 1 from public.traker_goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.traker_goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ));

drop policy if exists "work sessions: users own through goal" on public.traker_work_sessions;
create policy traker_work_sessions_owner_all on public.traker_work_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "goal progress: users own through goal" on public.traker_goal_progress_entries;
create policy traker_goal_progress_owner_all on public.traker_goal_progress_entries
  for all to authenticated
  using (exists (
    select 1 from public.traker_goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.traker_goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ));

drop policy if exists "goal events: users own through goal" on public.traker_goal_events;
create policy traker_goal_events_owner_all on public.traker_goal_events
  for all to authenticated
  using (exists (
    select 1 from public.traker_goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.traker_goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ));

drop policy if exists "goal sync operations: users own their rows" on public.traker_goal_sync_operations;
create policy traker_goal_sync_operations_owner_all on public.traker_goal_sync_operations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "product consents: users own their rows" on public.traker_product_consents;
create policy traker_product_consents_owner_all on public.traker_product_consents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy traker_goal_milestones_owner_all on public.traker_goal_milestones
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_habit_goal_links_owner_all on public.traker_habit_goal_links
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_habit_schedules_owner_all on public.traker_habit_schedules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_flexible_groups_owner_all on public.traker_flexible_groups
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_flexible_group_members_owner_all on public.traker_flexible_group_members
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_habit_logs_owner_all on public.traker_habit_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_daily_checkins_owner_all on public.traker_daily_checkins
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_rewards_owner_all on public.traker_rewards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_reward_rules_owner_all on public.traker_reward_rules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_reward_rule_sources_owner_all on public.traker_reward_rule_sources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_reward_claims_owner_all on public.traker_reward_claims
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_notification_preferences_owner_all on public.traker_notification_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy traker_notification_jobs_owner_select on public.traker_notification_jobs
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy traker_notification_deliveries_owner_select on public.traker_notification_deliveries
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy traker_sync_operations_owner_select on public.traker_sync_operations
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy traker_sync_cursors_owner_all on public.traker_sync_cursors
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No application table is available to anonymous clients.
revoke all on table
  public.habits,
  public.habit_entries,
  public.settings,
  public.push_subscriptions,
  public.sent_reminders,
  public.traker_goals,
  public.traker_goal_actions,
  public.traker_work_sessions,
  public.traker_goal_progress_entries,
  public.traker_goal_events,
  public.traker_goal_sync_operations,
  public.traker_product_consents,
  public.traker_goal_milestones,
  public.traker_habit_goal_links,
  public.traker_habit_schedules,
  public.traker_flexible_groups,
  public.traker_flexible_group_members,
  public.traker_habit_logs,
  public.traker_daily_checkins,
  public.traker_rewards,
  public.traker_reward_rules,
  public.traker_reward_rule_sources,
  public.traker_reward_claims,
  public.traker_notification_preferences,
  public.traker_notification_jobs,
  public.traker_notification_deliveries,
  public.traker_sync_operations,
  public.traker_sync_cursors
from public, anon;

grant select, insert, update, delete on table
  public.habits,
  public.habit_entries,
  public.settings,
  public.push_subscriptions,
  public.traker_goals,
  public.traker_goal_actions,
  public.traker_work_sessions,
  public.traker_goal_progress_entries,
  public.traker_goal_events,
  public.traker_goal_sync_operations,
  public.traker_product_consents,
  public.traker_goal_milestones,
  public.traker_habit_goal_links,
  public.traker_habit_schedules,
  public.traker_flexible_groups,
  public.traker_flexible_group_members,
  public.traker_habit_logs,
  public.traker_daily_checkins,
  public.traker_rewards,
  public.traker_reward_rules,
  public.traker_reward_rule_sources,
  public.traker_reward_claims,
  public.traker_notification_preferences,
  public.traker_sync_cursors
to authenticated;

grant select on table
  public.traker_notification_jobs,
  public.traker_notification_deliveries,
  public.traker_sync_operations
to authenticated;

revoke all on table public.sent_reminders from authenticated;

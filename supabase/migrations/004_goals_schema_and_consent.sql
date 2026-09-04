-- Traker Metas — additive schema, ownership policies and versioned consent.
-- Local-first remains authoritative until the sync RPC is enabled by the client.

create table if not exists traker_goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(120) not null check (char_length(title) between 1 and 120),
  personal_why text not null default '',
  desired_outcome text not null default '',
  done_definition text not null default '',
  status text not null check (status in ('draft','active','paused','completed','reformulated','abandoned','archived')),
  focus_rank smallint check (focus_rank is null or focus_rank >= 0),
  current_action_id uuid,
  reformulated_from_goal_id uuid references traker_goals(id),
  closed_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists traker_goal_actions (
  id uuid primary key,
  goal_id uuid not null references traker_goals(id) on delete cascade,
  title varchar(160) not null check (char_length(title) between 1 and 160),
  minimum_version varchar(160) not null default '',
  energy_level text check (energy_level is null or energy_level in ('low','medium','high')),
  estimate_bucket text,
  status text not null check (status in ('pending','ready','in_progress','blocked','completed','postponed','adapted','cancelled')),
  position_key text not null,
  blocked_reason text,
  adapted_from_action_id uuid references traker_goal_actions(id),
  deleted_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table traker_goals add constraint traker_goals_current_action_fk
    foreign key (current_action_id) references traker_goal_actions(id) deferrable initially deferred;
exception when duplicate_object then null;
end $$;

create table if not exists traker_work_sessions (
  id uuid primary key,
  goal_id uuid not null references traker_goals(id) on delete cascade,
  action_id uuid references traker_goal_actions(id) on delete set null,
  status text not null check (status in ('running','paused','finished','discarded')),
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_minutes integer check (planned_minutes is null or planned_minutes >= 0),
  actual_seconds integer check (actual_seconds is null or actual_seconds >= 0),
  outcome text check (outcome is null or outcome in ('partial','action_completed','blocked','stopped_intentionally')),
  device_id text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists traker_goal_progress_entries (
  id uuid primary key,
  goal_id uuid not null references traker_goals(id) on delete cascade,
  action_id uuid references traker_goal_actions(id) on delete set null,
  session_id uuid references traker_work_sessions(id) on delete set null,
  kind text not null check (kind in ('started','partial','blocked','action_completed','stage_completed','adjusted','help_requested')),
  note text not null default '',
  evidence_text text not null default '',
  client_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists traker_goal_events (
  id uuid primary key,
  goal_id uuid not null references traker_goals(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  client_id text,
  actor text not null default 'user',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists traker_goal_sync_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation_type text not null,
  base_version integer not null default 0,
  processed_at timestamptz not null default now()
);

create table if not exists traker_product_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('goals_sync','goals_analytics')),
  consent_version text not null,
  granted_at timestamptz not null,
  revoked_at timestamptz,
  primary key (user_id, purpose)
);

create index if not exists traker_goals_user_status_focus_idx on traker_goals(user_id, status, focus_rank, updated_at desc);
create index if not exists traker_goals_reformulated_from_idx on traker_goals(reformulated_from_goal_id);
create index if not exists traker_goal_actions_goal_idx on traker_goal_actions(goal_id, position_key);
create index if not exists traker_work_sessions_goal_idx on traker_work_sessions(goal_id, started_at desc);
create unique index if not exists traker_one_running_session_per_goal
  on traker_work_sessions(goal_id) where status = 'running';
create index if not exists traker_goal_progress_goal_time_idx on traker_goal_progress_entries(goal_id, occurred_at desc);
create index if not exists traker_goal_events_goal_time_idx on traker_goal_events(goal_id, occurred_at desc);

alter table traker_goals enable row level security;
alter table traker_goal_actions enable row level security;
alter table traker_work_sessions enable row level security;
alter table traker_goal_progress_entries enable row level security;
alter table traker_goal_events enable row level security;
alter table traker_goal_sync_operations enable row level security;
alter table traker_product_consents enable row level security;

drop policy if exists "goals: users own their rows" on traker_goals;
create policy "goals: users own their rows" on traker_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goal actions: users own through goal" on traker_goal_actions;
create policy "goal actions: users own through goal" on traker_goal_actions for all
  using (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()));

drop policy if exists "work sessions: users own through goal" on traker_work_sessions;
create policy "work sessions: users own through goal" on traker_work_sessions for all
  using (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()));

drop policy if exists "goal progress: users own through goal" on traker_goal_progress_entries;
create policy "goal progress: users own through goal" on traker_goal_progress_entries for all
  using (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()));

drop policy if exists "goal events: users own through goal" on traker_goal_events;
create policy "goal events: users own through goal" on traker_goal_events for all
  using (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from traker_goals g where g.id = goal_id and g.user_id = auth.uid()));

drop policy if exists "goal sync operations: users own their rows" on traker_goal_sync_operations;
create policy "goal sync operations: users own their rows" on traker_goal_sync_operations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "product consents: users own their rows" on traker_product_consents;
create policy "product consents: users own their rows" on traker_product_consents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

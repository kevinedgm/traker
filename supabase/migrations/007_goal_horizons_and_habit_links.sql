-- Goal horizons and optional habit-to-goal context.
-- The habit link intentionally has no foreign key: habit and goal cloud sync
-- have independent consent and availability.

alter table traker_goals
  add column if not exists horizon text not null default 'short'
  check (horizon in ('short','medium','long'));

alter table habits
  add column if not exists linked_goal_id uuid;

create index if not exists habits_linked_goal_idx
  on habits(user_id, linked_goal_id) where linked_goal_id is not null;

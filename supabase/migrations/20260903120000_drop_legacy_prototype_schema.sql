-- Retire the pre-migration-history prototype schema and its data leak.
--
-- `public.v_goal_progress` is a SECURITY DEFINER view with no user_id filter,
-- granted to anon: it lets any unauthenticated request read every user's
-- goal names and progress via PostgREST. It reads from `goals`/`milestones`/
-- `actions`, an early prototype of the goal model that predates this
-- migrations folder (no CREATE TABLE for these ever shipped in this repo)
-- and was fully superseded by the traker_goals/traker_goal_milestones family.
-- The app has never queried life_areas, goals, projects, milestones, actions,
-- goal_habits, action_sessions, reward_events, weekly_reviews or
-- user_preferences; base-table RLS ("own rows" policies) already blocked
-- anon/cross-user reads on all ten, so the view was the only real exposure.

begin;

do $legacy_guard$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'traker_goals'
  ) is false then
    raise exception 'LEGACY_CLEANUP_PRECONDITION: traker_goals must exist before dropping the prototype schema'
      using errcode = 'check_violation';
  end if;
end;
$legacy_guard$;

drop view if exists public.v_goal_progress;

drop table if exists public.action_sessions;
drop table if exists public.actions;
drop table if exists public.milestones;
drop table if exists public.projects;
drop table if exists public.goal_habits;
drop table if exists public.goals;
drop table if exists public.life_areas;
drop table if exists public.reward_events;
drop table if exists public.weekly_reviews;
drop table if exists public.user_preferences;

commit;

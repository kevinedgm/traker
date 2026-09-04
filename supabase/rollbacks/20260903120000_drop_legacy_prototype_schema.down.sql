-- Manual rollback for 20260903120000_drop_legacy_prototype_schema.sql.
--
-- Structural rollback only: recreates the ten prototype tables and the
-- v_goal_progress view exactly as they existed on tuzwecxijdblgihidhyo
-- before the cleanup (captured via `supabase db dump --linked -s public`
-- on 2026-09-03). It does NOT restore any rows that were dropped along with
-- the tables — those tables held disposable prototype/test data, confirmed
-- by the project owner as safe to discard, and were never read or written
-- by the application (verified: no `.from('<table>')` reference in src/ or
-- supabase/functions/). Do not re-run this unless you specifically need the
-- dead prototype schema back; it reintroduces the same v_goal_progress leak
-- (SECURITY DEFINER, no user filter, granted to anon) that this cleanup
-- exists to close.

begin;

create table if not exists "public"."life_areas" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "name" "text" not null,
    "icon" "text" default 'Circle'::"text",
    "color" "text" default '#CCFF00'::"text",
    "sort_order" integer default 0 not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "life_areas_name_check" check ((("char_length"("name") >= 1) and ("char_length"("name") <= 60))),
    constraint "life_areas_pkey" primary key ("id"),
    constraint "life_areas_user_id_name_key" unique ("user_id", "name"),
    constraint "life_areas_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
alter table "public"."life_areas" enable row level security;
create policy "life_areas: own rows" on "public"."life_areas" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
create or replace trigger "life_areas_updated_at" before update on "public"."life_areas" for each row execute function "public"."set_updated_at"();
grant all on table "public"."life_areas" to "anon", "authenticated", "service_role";

create table if not exists "public"."goals" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "area_id" "uuid",
    "name" "text" not null,
    "why" "text" default ''::"text",
    "horizon" "text" default 'mid'::"text" not null,
    "target_date" "date",
    "status" "text" default 'active'::"text" not null,
    "priority" smallint default 2 not null,
    "done_criteria" "text" default ''::"text",
    "final_reward" "text" default ''::"text",
    "difficulty" smallint default 2 not null,
    "notes" "text" default ''::"text",
    "last_progress_at" timestamp with time zone,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "goals_difficulty_check" check ((("difficulty" >= 1) and ("difficulty" <= 3))),
    constraint "goals_horizon_check" check (("horizon" = any (array['short'::"text", 'mid'::"text", 'long'::"text"]))),
    constraint "goals_name_check" check ((("char_length"("name") >= 1) and ("char_length"("name") <= 120))),
    constraint "goals_priority_check" check ((("priority" >= 1) and ("priority" <= 3))),
    constraint "goals_status_check" check (("status" = any (array['active'::"text", 'paused'::"text", 'done'::"text", 'archived'::"text"]))),
    constraint "goals_pkey" primary key ("id"),
    constraint "goals_area_id_fkey" foreign key ("area_id") references "public"."life_areas"("id") on delete set null,
    constraint "goals_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
create index "goals_user_status_idx" on "public"."goals" using "btree" ("user_id", "status", "horizon");
alter table "public"."goals" enable row level security;
create policy "goals: own rows" on "public"."goals" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
create or replace trigger "goals_updated_at" before update on "public"."goals" for each row execute function "public"."set_updated_at"();
grant all on table "public"."goals" to "anon", "authenticated", "service_role";

create table if not exists "public"."projects" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "goal_id" "uuid" not null,
    "name" "text" not null,
    "status" "text" default 'active'::"text" not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "projects_name_check" check ((("char_length"("name") >= 1) and ("char_length"("name") <= 120))),
    constraint "projects_status_check" check (("status" = any (array['active'::"text", 'done'::"text", 'archived'::"text"]))),
    constraint "projects_pkey" primary key ("id"),
    constraint "projects_goal_id_fkey" foreign key ("goal_id") references "public"."goals"("id") on delete cascade,
    constraint "projects_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
alter table "public"."projects" enable row level security;
create policy "projects: own rows" on "public"."projects" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
create or replace trigger "projects_updated_at" before update on "public"."projects" for each row execute function "public"."set_updated_at"();
grant all on table "public"."projects" to "anon", "authenticated", "service_role";

create table if not exists "public"."milestones" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "goal_id" "uuid" not null,
    "project_id" "uuid",
    "name" "text" not null,
    "done" boolean default false not null,
    "done_at" timestamp with time zone,
    "sort_order" integer default 0 not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "milestones_name_check" check ((("char_length"("name") >= 1) and ("char_length"("name") <= 160))),
    constraint "milestones_pkey" primary key ("id"),
    constraint "milestones_goal_id_fkey" foreign key ("goal_id") references "public"."goals"("id") on delete cascade,
    constraint "milestones_project_id_fkey" foreign key ("project_id") references "public"."projects"("id") on delete set null,
    constraint "milestones_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
create index "milestones_goal_idx" on "public"."milestones" using "btree" ("goal_id", "sort_order");
alter table "public"."milestones" enable row level security;
create policy "milestones: own rows" on "public"."milestones" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
create or replace trigger "milestones_updated_at" before update on "public"."milestones" for each row execute function "public"."set_updated_at"();
grant all on table "public"."milestones" to "anon", "authenticated", "service_role";

create table if not exists "public"."actions" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "goal_id" "uuid",
    "milestone_id" "uuid",
    "title" "text" not null,
    "estimate_min" integer default 15 not null,
    "energy" "text" default 'med'::"text" not null,
    "context" "text",
    "suggested_date" "date",
    "difficulty" smallint default 2 not null,
    "minimal_version" "text" default ''::"text",
    "status" "text" default 'todo'::"text" not null,
    "done_at" timestamp with time zone,
    "partial_count" integer default 0 not null,
    "postponed_count" integer default 0 not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "actions_context_check" check (("context" = any (array['casa'::"text", 'oficina'::"text", 'computadora'::"text", 'exterior'::"text", 'otro'::"text"]))),
    constraint "actions_difficulty_check" check ((("difficulty" >= 1) and ("difficulty" <= 3))),
    constraint "actions_energy_check" check (("energy" = any (array['low'::"text", 'med'::"text", 'high'::"text"]))),
    constraint "actions_estimate_min_check" check ((("estimate_min" >= 1) and ("estimate_min" <= 480))),
    constraint "actions_status_check" check (("status" = any (array['todo'::"text", 'done'::"text", 'archived'::"text"]))),
    constraint "actions_title_check" check ((("char_length"("title") >= 1) and ("char_length"("title") <= 200))),
    constraint "actions_pkey" primary key ("id"),
    constraint "actions_goal_id_fkey" foreign key ("goal_id") references "public"."goals"("id") on delete cascade,
    constraint "actions_milestone_id_fkey" foreign key ("milestone_id") references "public"."milestones"("id") on delete set null,
    constraint "actions_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
create index "actions_goal_idx" on "public"."actions" using "btree" ("goal_id");
create index "actions_user_status_idx" on "public"."actions" using "btree" ("user_id", "status", "suggested_date");
alter table "public"."actions" enable row level security;
create policy "actions: own rows" on "public"."actions" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
create or replace trigger "actions_updated_at" before update on "public"."actions" for each row execute function "public"."set_updated_at"();
grant all on table "public"."actions" to "anon", "authenticated", "service_role";

create table if not exists "public"."goal_habits" (
    "user_id" "uuid" not null,
    "goal_id" "uuid" not null,
    "habit_id" "uuid" not null,
    "created_at" timestamp with time zone default "now"() not null,
    constraint "goal_habits_pkey" primary key ("goal_id", "habit_id"),
    constraint "goal_habits_goal_id_fkey" foreign key ("goal_id") references "public"."goals"("id") on delete cascade,
    constraint "goal_habits_habit_id_fkey" foreign key ("habit_id") references "public"."habits"("id") on delete cascade,
    constraint "goal_habits_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
alter table "public"."goal_habits" enable row level security;
create policy "goal_habits: own rows" on "public"."goal_habits" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
grant all on table "public"."goal_habits" to "anon", "authenticated", "service_role";

create table if not exists "public"."action_sessions" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "action_id" "uuid" not null,
    "started_at" timestamp with time zone default "now"() not null,
    "minutes" integer default 0 not null,
    "outcome" "text" default 'partial'::"text" not null,
    "created_at" timestamp with time zone default "now"() not null,
    constraint "action_sessions_minutes_check" check ((("minutes" >= 0) and ("minutes" <= 480))),
    constraint "action_sessions_outcome_check" check (("outcome" = any (array['done'::"text", 'partial'::"text", 'paused'::"text"]))),
    constraint "action_sessions_pkey" primary key ("id"),
    constraint "action_sessions_action_id_fkey" foreign key ("action_id") references "public"."actions"("id") on delete cascade,
    constraint "action_sessions_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
create index "sessions_action_idx" on "public"."action_sessions" using "btree" ("action_id", "started_at");
alter table "public"."action_sessions" enable row level security;
create policy "action_sessions: own rows" on "public"."action_sessions" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
grant all on table "public"."action_sessions" to "anon", "authenticated", "service_role";

create table if not exists "public"."reward_events" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "type" "text" not null,
    "points" integer not null,
    "label" "text" default ''::"text",
    "meta" "jsonb" default '{}'::"jsonb",
    "created_at" timestamp with time zone default "now"() not null,
    constraint "reward_events_points_check" check (("points" >= 0)),
    constraint "reward_events_type_check" check (("type" = any (array['start_hard'::"text", 'complete_action'::"text", 'comeback'::"text", 'flex_consistency'::"text", 'milestone_done'::"text", 'weekly_review'::"text", 'split_task'::"text", 'partial_progress'::"text", 'surprise'::"text", 'first_win_day'::"text", 'weekly_chest'::"text"])),
    constraint "reward_events_pkey" primary key ("id"),
    constraint "reward_events_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
create index "reward_events_user_idx" on "public"."reward_events" using "btree" ("user_id", "created_at");
alter table "public"."reward_events" enable row level security;
create policy "reward_events: own rows" on "public"."reward_events" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
grant all on table "public"."reward_events" to "anon", "authenticated", "service_role";

create table if not exists "public"."weekly_reviews" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    "week_of" "date" not null,
    "answers" "jsonb" default '{}'::"jsonb" not null,
    "created_at" timestamp with time zone default "now"() not null,
    constraint "weekly_reviews_pkey" primary key ("id"),
    constraint "weekly_reviews_user_id_week_of_key" unique ("user_id", "week_of"),
    constraint "weekly_reviews_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
alter table "public"."weekly_reviews" enable row level security;
create policy "weekly_reviews: own rows" on "public"."weekly_reviews" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
grant all on table "public"."weekly_reviews" to "anon", "authenticated", "service_role";

create table if not exists "public"."user_preferences" (
    "user_id" "uuid" not null,
    "gamification_enabled" boolean default true not null,
    "gamification_intensity" "text" default 'subtle'::"text" not null,
    "quiet_hours_start" "text",
    "quiet_hours_end" "text",
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "user_preferences_gamification_intensity_check" check (("gamification_intensity" = any (array['off'::"text", 'subtle'::"text", 'full'::"text"]))),
    constraint "user_preferences_quiet_hours_end_check" check (("quiet_hours_end" ~ '^\d{2}:\d{2}$'::"text")),
    constraint "user_preferences_quiet_hours_start_check" check (("quiet_hours_start" ~ '^\d{2}:\d{2}$'::"text")),
    constraint "user_preferences_pkey" primary key ("user_id"),
    constraint "user_preferences_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade
);
alter table "public"."user_preferences" enable row level security;
create policy "user_preferences: own rows" on "public"."user_preferences" using (("auth"."uid"() = "user_id")) with check (("auth"."uid"() = "user_id"));
create or replace trigger "user_preferences_updated_at" before update on "public"."user_preferences" for each row execute function "public"."set_updated_at"();
grant all on table "public"."user_preferences" to "anon", "authenticated", "service_role";

-- Recreated for structural completeness only. This view is the exact leak
-- the forward migration exists to close (SECURITY DEFINER, no user_id
-- filter, granted to anon) — re-run the forward migration again once you no
-- longer need the prototype schema back.
create or replace view "public"."v_goal_progress" as
 select "g"."id" as "goal_id",
    "g"."user_id",
    "g"."name",
    "g"."horizon",
    "g"."status",
    "count"("m"."id") as "milestones_total",
    "count"("m"."id") filter (where "m"."done") as "milestones_done",
    "count"("a"."id") filter (where ("a"."status" = 'done'::"text")) as "actions_done",
    "count"("a"."id") filter (where ("a"."status" = 'todo'::"text")) as "actions_pending",
    "g"."last_progress_at"
   from (("public"."goals" "g"
     left join "public"."milestones" "m" on (("m"."goal_id" = "g"."id")))
     left join "public"."actions" "a" on (("a"."goal_id" = "g"."id")))
  group by "g"."id";
grant all on table "public"."v_goal_progress" to "anon", "authenticated", "service_role";

commit;

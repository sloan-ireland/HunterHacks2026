create table if not exists user_planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dataset_id text not null default 'hunter-current-catalog',
  college text,
  major text,
  completed_codes text[] not null default '{}',
  selected_elective_codes text[] not null default '{}',
  selected_course_code text,
  include_summer boolean not null default false,
  max_credits integer not null default 15,
  active_scenario_key text,
  updated_at timestamptz not null default now()
);

alter table user_planner_states enable row level security;

drop policy if exists "Users can read own planner state" on user_planner_states;
drop policy if exists "Users can insert own planner state" on user_planner_states;
drop policy if exists "Users can update own planner state" on user_planner_states;

create policy "Users can read own planner state"
on user_planner_states
for select
using (auth.uid() = user_id);

create policy "Users can insert own planner state"
on user_planner_states
for insert
with check (auth.uid() = user_id);

create policy "Users can update own planner state"
on user_planner_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

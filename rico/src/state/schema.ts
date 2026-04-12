export const BOOTSTRAP_SQL = `
create table if not exists projects (
  id text primary key,
  slack_channel_id text not null,
  priority integer not null default 0,
  paused integer not null default 0
);

create table if not exists initiatives (
  id text primary key,
  project_id text not null,
  title text not null,
  status text not null
);

create table if not exists goals (
  id text primary key,
  initiative_id text,
  project_id text not null,
  title text not null,
  state text not null
);

create table if not exists runs (
  id text primary key,
  goal_id text not null,
  status text not null,
  queued_at text,
  started_at text,
  finished_at text,
  foreign key (goal_id) references goals(id) on delete cascade
);

create table if not exists tasks (
  id text primary key,
  goal_id text not null,
  run_id text not null,
  role text not null,
  state text not null,
  payload_json text not null,
  foreign key (run_id) references runs(id) on delete cascade,
  foreign key (goal_id) references goals(id) on delete cascade
);

create table if not exists approvals (
  id text primary key,
  goal_id text not null,
  type text not null,
  status text not null,
  rationale text
);

create table if not exists artifacts (
  id text primary key,
  goal_id text not null,
  kind text not null,
  local_path text not null,
  slack_file_id text
);

create table if not exists state_transitions (
  id text primary key,
  goal_id text not null,
  from_state text,
  to_state text not null,
  created_at text not null,
  actor text not null
);

create table if not exists project_memory (
  project_id text not null,
  key text not null,
  value text not null,
  primary key (project_id, key)
);

create table if not exists run_memory (
  run_id text not null,
  key text not null,
  value text not null,
  primary key (run_id, key)
);

create table if not exists role_playbooks (
  role text not null,
  key text not null,
  value text not null,
  primary key (role, key)
);
`;

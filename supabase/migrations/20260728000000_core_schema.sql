-- DudaPlan — modelo de dados completo.
--
-- Notas sobre a ordem das tabelas: o documento de modelagem lista as tabelas por
-- assunto, não por dependência. Aqui elas aparecem na ordem em que o Postgres
-- consegue criá-las, e as duas foreign keys circulares (tasks -> meetings e
-- tasks -> transcript_segments) entram como ALTER TABLE no fim.
--
-- public.users.id referencia auth.users(id): assim `auth.uid()` casa direto com
-- users.id e as políticas de RLS ficam simples. Um trigger em auth.users cria a
-- linha correspondente no cadastro.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Núcleo organizacional
-- ---------------------------------------------------------------------------

create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null unique,
  name          text not null,
  avatar_url    text,
  timezone      text not null default 'America/Sao_Paulo',
  work_start    time,
  work_end      time,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on users
  for each row execute function public.set_updated_at();

create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on workspaces (owner_id);

create trigger workspaces_set_updated_at
  before update on workspaces
  for each row execute function public.set_updated_at();

create table memberships (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null default 'member'
                check (role in ('owner','admin','member','guest')),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index on memberships (user_id);
create index on memberships (workspace_id);

create table areas (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  color         text,
  icon          text,
  position      numeric not null default 1000,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on areas (workspace_id) where archived_at is null;

create trigger areas_set_updated_at
  before update on areas
  for each row execute function public.set_updated_at();

create table projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  area_id       uuid references areas(id) on delete set null,
  name          text not null,
  -- "como eu sei que terminou" — obrigatório de propósito (invariante 1)
  outcome       text not null check (length(btrim(outcome)) > 0),
  description   jsonb,
  status        text not null default 'planning'
                check (status in ('planning','active','on_hold','done','cancelled')),
  owner_id      uuid references users(id) on delete set null,
  start_date    date,
  due_date      date,
  completed_at  timestamptz,
  position      numeric not null default 1000,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on projects (workspace_id, status) where archived_at is null;
create index on projects (area_id);
create index on projects (owner_id);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function public.set_updated_at();

create table milestones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  name         text not null,
  due_date     date,
  completed_at timestamptz,
  position     numeric not null default 1000,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on milestones (project_id);

create trigger milestones_set_updated_at
  before update on milestones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reuniões (antes de tasks: tasks referencia meetings e transcript_segments)
-- ---------------------------------------------------------------------------

create table meetings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,
  series_id     uuid,

  title         text not null,
  objective     text,
  agenda        jsonb,
  scheduled_at  timestamptz,
  started_at    timestamptz,
  ended_at      timestamptz,
  duration_sec  integer,

  status        text not null default 'scheduled'
                check (status in ('scheduled','recording','processing','ready','failed')),
  processing_error text,

  created_by    uuid references users(id) on delete set null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on meetings (project_id, scheduled_at desc);
create index on meetings (series_id, scheduled_at desc);
create index on meetings (workspace_id, status);
create index on meetings (created_by);

create trigger meetings_set_updated_at
  before update on meetings
  for each row execute function public.set_updated_at();

create table meeting_participants (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references meetings(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  external_name text,
  speaker_label text,
  role          text check (role in ('organizer','required','optional')),
  attended      boolean,
  unique (meeting_id, speaker_label)
);

create index on meeting_participants (meeting_id);
create index on meeting_participants (user_id);

create table recordings (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references meetings(id) on delete cascade,
  storage_path  text not null,
  mime_type     text not null,
  size_bytes    bigint,
  duration_sec  integer,
  created_at    timestamptz not null default now()
);

create index on recordings (meeting_id);

create table transcripts (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references meetings(id) on delete cascade,
  language      text default 'pt-BR',
  provider      text,
  model         text,
  full_text     text,
  created_at    timestamptz not null default now(),
  unique (meeting_id)
);

create table transcript_segments (
  id            uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts(id) on delete cascade,
  speaker_label text,
  start_ms      integer not null,
  end_ms        integer not null,
  text          text not null,
  confidence    real,
  created_at    timestamptz not null default now()
);

create index on transcript_segments (transcript_id, start_ms);

create table meeting_artifacts (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references meetings(id) on delete cascade,
  kind           text not null
                 check (kind in ('transcript_summary','minutes','flowchart','action_plan','decisions')),
  version        integer not null default 1,
  content        jsonb not null,
  model          text,
  prompt_version text,
  edited_by_user boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (meeting_id, kind, version)
);

create index on meeting_artifacts (meeting_id, kind, version desc);

-- ---------------------------------------------------------------------------
-- Execução
-- ---------------------------------------------------------------------------

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  milestone_id      uuid references milestones(id) on delete set null,
  parent_task_id    uuid references tasks(id) on delete cascade,

  title             text not null,
  description       jsonb,
  status            text not null default 'todo'
                    check (status in ('backlog','todo','in_progress','waiting','done','cancelled')),
  priority          text not null default 'medium'
                    check (priority in ('low','medium','high','urgent')),
  energy            text check (energy in ('low','medium','high')),

  assignee_id       uuid references users(id) on delete set null,

  scheduled_date    date,
  due_date          date,
  estimate_minutes  integer check (estimate_minutes > 0),
  actual_minutes    integer,

  intention_trigger text,
  blocked_reason    text,

  source_type       text not null default 'manual'
                    check (source_type in ('manual','meeting','ai','inbox','recurring')),
  source_meeting_id uuid,
  source_segment_id uuid,

  position          numeric not null default 1000,
  completed_at      timestamptz,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- invariante 3: waiting exige motivo
  constraint tasks_waiting_needs_reason
    check (status <> 'waiting' or length(btrim(coalesce(blocked_reason, ''))) > 0),
  -- invariante 4: completed_at existe se e somente se status = 'done'
  constraint tasks_completed_at_matches_status
    check ((status = 'done') = (completed_at is not null))
);

alter table tasks
  add constraint tasks_source_meeting_id_fkey
  foreign key (source_meeting_id) references meetings(id) on delete set null;

alter table tasks
  add constraint tasks_source_segment_id_fkey
  foreign key (source_segment_id) references transcript_segments(id) on delete set null;

-- sustenta a visão "Hoje" — a query mais quente do sistema
create index on tasks (workspace_id, assignee_id, scheduled_date)
  where status not in ('done','cancelled') and archived_at is null;

create index on tasks (project_id) where archived_at is null;
create index on tasks (parent_task_id);
create index on tasks (milestone_id);
create index on tasks (assignee_id);
create index on tasks (source_meeting_id);
create index on tasks (source_segment_id);
create index on tasks (due_date) where status not in ('done','cancelled');

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function public.set_updated_at();

create table task_dependencies (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references tasks(id) on delete cascade,
  depends_on_id uuid not null references tasks(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create index on task_dependencies (task_id);
create index on task_dependencies (depends_on_id);

create table tags (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  color         text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, name)
);

create table task_tags (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id  uuid not null references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

create index on task_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Rotinas
-- ---------------------------------------------------------------------------

create table routines (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  area_id       uuid references areas(id) on delete set null,

  name          text not null,
  description   text,
  cadence       text not null default 'daily'
                check (cadence in ('daily','weekdays','weekly','custom')),
  active_days   smallint[],
  target_time   time,
  position      numeric not null default 1000,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on routines (user_id) where archived_at is null;
create index on routines (workspace_id);
create index on routines (area_id);

create trigger routines_set_updated_at
  before update on routines
  for each row execute function public.set_updated_at();

create table routine_logs (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  log_date   date not null,
  completed  boolean not null default true,
  skipped    boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  unique (routine_id, log_date),
  -- invariante 9: pulado e concluído são estados distintos
  constraint routine_logs_not_completed_and_skipped
    check (not (completed and skipped))
);

create index on routine_logs (routine_id, log_date desc);

-- ---------------------------------------------------------------------------
-- Captura
-- ---------------------------------------------------------------------------

create table inbox_items (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  content           text not null,
  status            text not null default 'unprocessed'
                    check (status in ('unprocessed','converted','discarded')),
  converted_task_id uuid references tasks(id) on delete set null,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);

create index on inbox_items (user_id, status) where status = 'unprocessed';
create index on inbox_items (workspace_id);
create index on inbox_items (converted_task_id);

-- ---------------------------------------------------------------------------
-- IA: fila de triagem e decisões
-- ---------------------------------------------------------------------------

create table ai_suggestions (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  meeting_id       uuid references meetings(id) on delete cascade,
  segment_id       uuid references transcript_segments(id) on delete set null,

  kind             text not null
                   check (kind in ('task','decision','risk','follow_up','note')),
  payload          jsonb not null,
  confidence       real,
  reasoning        text,

  status           text not null default 'pending'
                   check (status in ('pending','approved','edited','rejected')),
  resolved_by      uuid references users(id) on delete set null,
  resolved_at      timestamptz,
  created_task_id  uuid references tasks(id) on delete set null,
  rejection_reason text,

  model            text,
  prompt_version   text,
  created_at       timestamptz not null default now()
);

create index on ai_suggestions (workspace_id, status) where status = 'pending';
create index on ai_suggestions (meeting_id);
create index on ai_suggestions (segment_id);
create index on ai_suggestions (created_task_id);
create index on ai_suggestions (resolved_by);

create table decisions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,
  meeting_id    uuid references meetings(id) on delete set null,
  segment_id    uuid references transcript_segments(id) on delete set null,

  statement     text not null,
  rationale     text,
  decided_by    uuid references users(id) on delete set null,
  decided_at    timestamptz not null default now(),
  superseded_by uuid references decisions(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index on decisions (project_id, decided_at desc);
create index on decisions (meeting_id);
create index on decisions (workspace_id);
create index on decisions (segment_id);
create index on decisions (superseded_by);
create index on decisions (decided_by);

-- ---------------------------------------------------------------------------
-- Conhecimento
-- ---------------------------------------------------------------------------

create table notes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid references projects(id) on delete cascade,
  area_id       uuid references areas(id) on delete set null,
  title         text not null,
  content       jsonb,
  created_by    uuid references users(id) on delete set null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on notes (project_id) where archived_at is null;
create index on notes (workspace_id);
create index on notes (area_id);
create index on notes (created_by);

create trigger notes_set_updated_at
  before update on notes
  for each row execute function public.set_updated_at();

create table attachments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  entity_type   text not null check (entity_type in ('task','project','meeting','note')),
  entity_id     uuid not null,
  filename      text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index on attachments (entity_type, entity_id);
create index on attachments (workspace_id);
create index on attachments (uploaded_by);

-- ---------------------------------------------------------------------------
-- Revisão semanal e auditoria
-- ---------------------------------------------------------------------------

create table weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  week_start      date not null,
  completed_steps text[],
  reflection      text,
  stats_snapshot  jsonb,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, week_start)
);

create index on weekly_reviews (workspace_id);

create table activity_log (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id     uuid references users(id) on delete set null,
  actor_type   text not null default 'user' check (actor_type in ('user','ai','system')),
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null,
  changes      jsonb,
  created_at   timestamptz not null default now()
);

create index on activity_log (entity_type, entity_id, created_at desc);
create index on activity_log (workspace_id, created_at desc);
create index on activity_log (actor_id);

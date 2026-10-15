-- DudaPlan — schema completo, para Postgres puro (sem Supabase).
--
-- App de uma pessoa só: toda linha de dados carrega `user_id` e o app filtra
-- por ele em cada consulta. Não há RLS — o banco roda local, sem Data API, e o
-- único cliente dele é o servidor Next.
--
-- As tabelas filhas herdam a posse do pai. Onde um pai aponta para outro dono
-- (tarefa -> projeto, reunião -> projeto), a chave estrangeira é composta
-- `(project_id, user_id)`: o banco recusa ligar a linha de uma conta ao projeto
-- de outra, sem depender de o app lembrar de checar.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conta e sessão
-- ---------------------------------------------------------------------------

create table users (
  id            uuid primary key default gen_random_uuid(),
  -- sempre minúsculo: o app normaliza antes de gravar, e o CHECK impede que
  -- um caminho esquecido grave "Ana@x.com" e quebre o login.
  email         text not null unique check (email = lower(email)),
  name          text not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- Só o hash SHA-256 do token fica aqui. Quem lê o banco (ou um backup) não
-- consegue forjar um cookie de sessão.
create table sessions (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index on sessions (user_id);
create index on sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------------------

create table projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  name                text not null,
  -- "por que existe" e "como sei que terminou": obrigatórios de propósito
  problem             text not null check (length(btrim(problem)) > 0),
  outcome             text not null check (length(btrim(outcome)) > 0),
  status              text not null default 'planning'
                      check (status in ('planning','active','on_hold','done','cancelled')),
  start_date          date,
  -- Três prazos em vez de uma data fingida. Nenhuma ordem é imposta entre
  -- eles: qual é maior depende de como cada pessoa usa as três categorias.
  deadline_optimistic date not null,
  deadline_mediocre   date not null,
  deadline_realistic  date not null,
  completed_at        timestamptz,
  position            numeric not null default 1000,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- alvo das chaves estrangeiras compostas das tabelas que apontam para projeto
  unique (id, user_id)
);

create index on projects (user_id, status) where archived_at is null;
create index on projects (user_id, deadline_realistic) where archived_at is null;

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------------

create table tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  project_id       uuid,
  title            text not null,
  status           text not null default 'todo'
                   check (status in ('backlog','todo','in_progress','waiting','done','cancelled')),
  priority         text not null default 'medium'
                   check (priority in ('low','medium','high','urgent')),
  energy           text check (energy in ('low','medium','high')),
  scheduled_date   date,
  due_date         date,
  estimate_minutes integer check (estimate_minutes > 0),
  blocked_reason   text,
  position         numeric not null default 1000,
  completed_at     timestamptz,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- apagar o projeto leva as tarefas dele
  foreign key (project_id, user_id) references projects (id, user_id) on delete cascade,

  -- waiting exige motivo
  constraint tasks_waiting_needs_reason
    check (status <> 'waiting' or length(btrim(coalesce(blocked_reason, ''))) > 0),
  -- completed_at existe se e somente se status = 'done'
  constraint tasks_completed_at_matches_status
    check ((status = 'done') = (completed_at is not null))
);

-- sustenta a tela "Hoje", a consulta mais quente
create index on tasks (user_id, scheduled_date)
  where status not in ('done','cancelled') and archived_at is null;
create index on tasks (project_id) where archived_at is null;
create index on tasks (user_id, due_date) where status not in ('done','cancelled');

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Reuniões
-- ---------------------------------------------------------------------------

create table meetings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  project_id    uuid,
  title         text not null,
  -- texto livre, renderizado como Markdown
  notes         text,
  scheduled_at  timestamptz,
  duration_sec  integer,
  status        text not null default 'scheduled'
                check (status in ('scheduled','recording','processing','ready','failed')),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),

  -- apagar o projeto solta a reunião, não a apaga. A lista de colunas é o que
  -- impede o SET NULL de zerar também user_id (NOT NULL).
  foreign key (project_id, user_id) references projects (id, user_id)
    on delete set null (project_id)
);

create index on meetings (user_id, scheduled_at desc) where archived_at is null;
create index on meetings (project_id);

create trigger meetings_set_updated_at
  before update on meetings
  for each row execute function set_updated_at();

create table meeting_participants (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  name        text not null
);

create index on meeting_participants (meeting_id);

create table recordings (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references meetings(id) on delete cascade,
  -- relativo a UPLOAD_DIR
  storage_path  text not null,
  mime_type     text not null,
  size_bytes    bigint,
  duration_sec  integer,
  created_at    timestamptz not null default now()
);

create index on recordings (meeting_id);

-- ---------------------------------------------------------------------------
-- Rotinas
-- ---------------------------------------------------------------------------

create table routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  description text,
  cadence     text not null default 'daily'
              check (cadence in ('daily','weekdays','weekly','custom')),
  -- dias da semana (0 = domingo); só a cadência 'custom' usa
  active_days smallint[],
  target_time time,
  -- Endereço que a rotina abre. Só http/https é validado no Zod, onde a
  -- mensagem de erro pode explicar o que fazer.
  link        text,
  -- nulo é caso normal: rotina sem hora marcada
  shift       text check (shift is null or shift in ('morning','afternoon','night')),
  position    numeric not null default 1000,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on routines (user_id, position) where archived_at is null;

create trigger routines_set_updated_at
  before update on routines
  for each row execute function set_updated_at();

create table routine_logs (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references routines(id) on delete cascade,
  log_date    date not null,
  completed   boolean not null default true,
  skipped     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (routine_id, log_date),
  -- pulado e concluído são estados distintos
  constraint routine_logs_not_completed_and_skipped
    check (not (completed and skipped))
);

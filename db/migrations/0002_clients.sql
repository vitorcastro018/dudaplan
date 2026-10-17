-- ---------------------------------------------------------------------------
-- Clientes
--
-- Ficam acima dos projetos na hierarquia: cliente > projeto > tarefa. Mas o
-- vínculo é opcional em projetos, tarefas e reuniões, e tarefas e reuniões
-- também podem apontar para o cliente direto, sem passar por um projeto.
-- ---------------------------------------------------------------------------

create table clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  -- quem é o cliente, o que ele faz, combinados gerais: texto livre
  description text,
  -- contato principal (nome, e-mail, telefone): texto livre
  contact     text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- alvo das chaves estrangeiras compostas, como em projects
  unique (id, user_id)
);

create index on clients (user_id, name) where archived_at is null;

create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- Apagar o cliente solta projetos, tarefas e reuniões, não os apaga. A lista de
-- colunas do SET NULL é o que impede de zerar também user_id (NOT NULL).
alter table projects add column client_id uuid;
alter table projects add foreign key (client_id, user_id)
  references clients (id, user_id) on delete set null (client_id);
create index on projects (client_id) where archived_at is null;

alter table tasks add column client_id uuid;
alter table tasks add foreign key (client_id, user_id)
  references clients (id, user_id) on delete set null (client_id);
create index on tasks (client_id) where archived_at is null;

alter table meetings add column client_id uuid;
alter table meetings add foreign key (client_id, user_id)
  references clients (id, user_id) on delete set null (client_id);
create index on meetings (client_id);

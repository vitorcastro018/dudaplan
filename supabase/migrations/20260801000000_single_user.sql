-- Enxugamento: o DudaPlan passa a ser um app de uma pessoa só.
--
-- O modelo original previa equipes (workspaces, associações, papéis) e um
-- pipeline de IA completo (transcrição, artefatos, sugestões, decisões...).
-- Nada disso chegou à interface: o app lê e escreve em 8 das 25 tabelas, e cada
-- tabela sobrando carregava política de RLS, índices, testes e tipos.
--
-- O que muda:
--   * Tabelas sem uso saem. Elas estavam vazias — nenhuma tela as alcançava.
--   * `workspaces` e `memberships` saem. A posse passa a ser direta:
--     `user_id = auth.uid()` em projects, tasks, meetings e routines. Os dados
--     existentes são migrados (o dono do workspace vira o dono da linha).
--   * O RLS fica uma política por operação por tabela, sem função auxiliar
--     SECURITY DEFINER e sem recursão entre `users` e `memberships`.
--   * O trigger de cadastro cria só o perfil.
--
-- Se um dia o app voltar a ter mais de um usuário, o caminho é reintroduzir a
-- camada de compartilhamento por cima de `user_id`, não restaurar o que saiu.

-- ---------------------------------------------------------------------------
-- 1. Tabelas e colunas sem uso
-- ---------------------------------------------------------------------------

drop table if exists
  activity_log, weekly_reviews, attachments, notes, decisions, ai_suggestions,
  inbox_items, task_tags, tags, task_dependencies, meeting_artifacts,
  transcript_segments, transcripts, milestones, areas
  cascade;

-- Os gatilhos que dependiam das tabelas acima.
drop trigger if exists meetings_enforce_ready on meetings;
drop function if exists public.enforce_meeting_ready();
drop function if exists public.enforce_ai_suggestion_transition();

-- Chaves para as tabelas removidas.
alter table projects drop column if exists area_id;
alter table routines drop column if exists area_id;
alter table tasks    drop column if exists milestone_id;
alter table tasks    drop column if exists source_segment_id;

-- ---------------------------------------------------------------------------
-- 2. Posse direta: workspace_id -> user_id
-- ---------------------------------------------------------------------------

alter table projects add column user_id uuid references users(id) on delete cascade;
alter table tasks    add column user_id uuid references users(id) on delete cascade;
alter table meetings add column user_id uuid references users(id) on delete cascade;

update projects p set user_id = w.owner_id from workspaces w where w.id = p.workspace_id;
update tasks    t set user_id = w.owner_id from workspaces w where w.id = t.workspace_id;
update meetings m set user_id = w.owner_id from workspaces w where w.id = m.workspace_id;

alter table projects alter column user_id set not null;
alter table tasks    alter column user_id set not null;
alter table meetings alter column user_id set not null;

-- ---------------------------------------------------------------------------
-- 3. RLS novo (as políticas antigas dependem de workspace_id)
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'users','projects','tasks','meetings','meeting_participants',
        'recordings','routines','routine_logs'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

alter table projects drop column workspace_id;
alter table tasks    drop column workspace_id;
alter table meetings drop column workspace_id;
alter table routines drop column workspace_id;

drop table workspaces cascade;   -- leva memberships junto
drop table if exists memberships cascade;
drop function if exists public.current_user_workspace_ids();

-- Uma política por operação, com `to authenticated` e predicado de posse.
-- `(select auth.uid())` para o Postgres avaliar uma vez por query, não por linha.
-- UPDATE leva USING e WITH CHECK: sem o segundo dá para reatribuir a linha.

create policy "lê o próprio perfil" on users for select to authenticated
  using (id = (select auth.uid()));
create policy "edita o próprio perfil" on users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['projects','tasks','meetings','routines']
  loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy "lê o que é seu" on %I for select to authenticated
      using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "cria o que é seu" on %I for insert to authenticated
      with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "edita o que é seu" on %I for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "apaga o que é seu" on %I for delete to authenticated
      using (user_id = (select auth.uid()))$p$, t);
  end loop;
end;
$$;

-- Tabelas filhas herdam a posse do pai.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('meeting_participants', 'meeting_id', 'meetings'),
      ('recordings',           'meeting_id', 'meetings'),
      ('routine_logs',         'routine_id', 'routines')
    ) as v(child, fk, parent)
  loop
    execute format('alter table %I enable row level security', spec.child);
    execute format($p$create policy "lê o que é seu" on %I for select to authenticated
      using (exists (select 1 from %I p where p.id = %I.%I and p.user_id = (select auth.uid())))$p$,
      spec.child, spec.parent, spec.child, spec.fk);
    execute format($p$create policy "cria o que é seu" on %I for insert to authenticated
      with check (exists (select 1 from %I p where p.id = %I.%I and p.user_id = (select auth.uid())))$p$,
      spec.child, spec.parent, spec.child, spec.fk);
    execute format($p$create policy "edita o que é seu" on %I for update to authenticated
      using (exists (select 1 from %I p where p.id = %I.%I and p.user_id = (select auth.uid())))
      with check (exists (select 1 from %I p where p.id = %I.%I and p.user_id = (select auth.uid())))$p$,
      spec.child, spec.parent, spec.child, spec.fk, spec.parent, spec.child, spec.fk);
    execute format($p$create policy "apaga o que é seu" on %I for delete to authenticated
      using (exists (select 1 from %I p where p.id = %I.%I and p.user_id = (select auth.uid())))$p$,
      spec.child, spec.parent, spec.child, spec.fk);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Índices que dependiam de workspace_id
-- ---------------------------------------------------------------------------

create index on projects (user_id, status) where archived_at is null;
create index on projects (user_id, deadline_realistic) where archived_at is null;
create index on meetings (user_id, status);
-- sustenta a tela "Hoje", a consulta mais quente
create index on tasks (user_id, scheduled_date)
  where status not in ('done','cancelled') and archived_at is null;
create index on routines (user_id, position) where archived_at is null;

-- ---------------------------------------------------------------------------
-- 5. Cadastro: só o perfil
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  display_name text;
begin
  -- `raw_user_meta_data` é editável pelo usuário: serve só para nome de exibição.
  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    display_name,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- Row Level Security.
--
-- Modelo de acesso: tudo pertence a um workspace; você enxerga o que está nos
-- workspaces em que você é membro. Tabelas sem workspace_id próprio (milestones,
-- gravações, segmentos...) herdam pelo pai.
--
-- Decisões seguindo o checklist de segurança do Supabase:
--   * `TO authenticated` sozinho é autenticação sem autorização — toda política
--     combina o papel com um predicado de posse.
--   * Nada de `auth.role()`: além de depreciado, usuários anônimos carregam o
--     papel `authenticated` e passariam na checagem.
--   * `(select auth.uid())` em vez de `auth.uid()` solto: sem o select, o
--     Postgres reavalia a função por linha em vez de uma vez por query.
--   * UPDATE leva USING **e** WITH CHECK. Só com USING o usuário consegue
--     reatribuir a linha para outro workspace ao editá-la.
--
-- Sobre a função auxiliar ser SECURITY DEFINER:
-- ela lê `memberships`, e as políticas de `memberships` e `users` precisam
-- consultar os workspaces do usuário. Com SECURITY INVOKER isso vira recursão
-- (política de memberships -> função -> select em memberships -> política de
-- novo), e o Postgres aborta com "infinite recursion detected in policy".
-- DEFINER quebra o ciclo porque o select interno não passa pelo RLS.
-- O que a torna segura, e não um buraco no controle de acesso:
--   * não recebe argumentos — não há como pedir os workspaces de outra pessoa;
--   * o corpo filtra por `auth.uid()`, então devolve só o que o próprio
--     chamador já sabe;
--   * `search_path` fixo, senão o dono da sessão poderia apontar `memberships`
--     para uma tabela sua e a função rodaria com privilégio elevado em cima dela;
--   * EXECUTE revogado de PUBLIC (o Postgres concede por padrão) e liberado
--     apenas para `authenticated`, senão viraria endpoint público via Data API.

create or replace function public.current_user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select workspace_id from memberships where user_id = (select auth.uid())
$$;

revoke execute on function public.current_user_workspace_ids() from public, anon;
grant execute on function public.current_user_workspace_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Identidade
-- ---------------------------------------------------------------------------

alter table users enable row level security;

create policy "usuário lê o próprio perfil e o de colegas de workspace"
  on users for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from memberships m
      where m.user_id = users.id
        and m.workspace_id in (select public.current_user_workspace_ids())
    )
  );

create policy "usuário edita o próprio perfil"
  on users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter table memberships enable row level security;

-- Enxerga as próprias associações e as dos colegas dos seus workspaces. A
-- segunda parte é o que faz a política de `users` acima funcionar de verdade:
-- restrita a `user_id = auth.uid()`, aquele EXISTS só encontraria a si mesmo e
-- ninguém jamais veria o perfil de um colega.
create policy "usuário lê associações dos seus workspaces"
  on memberships for select to authenticated
  using (workspace_id in (select public.current_user_workspace_ids()));

-- Sem INSERT aqui, criar um workspace deixaria o criador sem associação —
-- e como todo acesso passa por `memberships`, ele não conseguiria enxergar o
-- workspace que acabou de criar. Quem é dono se inscreve e inscreve os outros.
create policy "dono do workspace gerencia associações"
  on memberships for insert to authenticated
  with check (exists (
    select 1 from workspaces w
    where w.id = memberships.workspace_id and w.owner_id = (select auth.uid())
  ));

create policy "dono do workspace edita associações"
  on memberships for update to authenticated
  using (exists (
    select 1 from workspaces w
    where w.id = memberships.workspace_id and w.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from workspaces w
    where w.id = memberships.workspace_id and w.owner_id = (select auth.uid())
  ));

-- O dono remove qualquer um; o membro pode sair sozinho.
create policy "dono remove associações, membro sai do workspace"
  on memberships for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from workspaces w
      where w.id = memberships.workspace_id and w.owner_id = (select auth.uid())
    )
  );

alter table workspaces enable row level security;

-- O `owner_id` não é redundante com a associação: entre criar o workspace e
-- criar a própria associação o dono ainda não é membro, e sem esta metade ele
-- não enxergaria a linha que acabou de inserir — inclusive dentro do EXISTS
-- das políticas de `memberships`, que é onde o cadastro travaria de vez.
create policy "membros e dono leem o workspace"
  on workspaces for select to authenticated
  using (
    owner_id = (select auth.uid())
    or id in (select public.current_user_workspace_ids())
  );

create policy "dono edita o workspace"
  on workspaces for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "usuário cria workspace para si"
  on workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "dono apaga o workspace"
  on workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Tabelas com workspace_id próprio
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'areas','projects','tasks','tags','routines','inbox_items',
    'ai_suggestions','decisions','notes','attachments','weekly_reviews',
    'meetings','activity_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);

    execute format($p$
      create policy "membros leem" on %I for select to authenticated
      using (workspace_id in (select public.current_user_workspace_ids()))
    $p$, t);

    execute format($p$
      create policy "membros criam" on %I for insert to authenticated
      with check (workspace_id in (select public.current_user_workspace_ids()))
    $p$, t);

    execute format($p$
      create policy "membros editam" on %I for update to authenticated
      using (workspace_id in (select public.current_user_workspace_ids()))
      with check (workspace_id in (select public.current_user_workspace_ids()))
    $p$, t);

    execute format($p$
      create policy "membros apagam" on %I for delete to authenticated
      using (workspace_id in (select public.current_user_workspace_ids()))
    $p$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas que herdam o workspace pelo pai
-- ---------------------------------------------------------------------------

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('milestones',           'project_id',    'projects'),
      ('meeting_participants', 'meeting_id',    'meetings'),
      ('recordings',           'meeting_id',    'meetings'),
      ('transcripts',          'meeting_id',    'meetings'),
      ('meeting_artifacts',    'meeting_id',    'meetings')
    ) as v(child, fk, parent)
  loop
    execute format('alter table %I enable row level security', spec.child);

    execute format($p$
      create policy "membros leem" on %I for select to authenticated
      using (exists (
        select 1 from %I p
        where p.id = %I.%I
          and p.workspace_id in (select public.current_user_workspace_ids())
      ))
    $p$, spec.child, spec.parent, spec.child, spec.fk);

    execute format($p$
      create policy "membros criam" on %I for insert to authenticated
      with check (exists (
        select 1 from %I p
        where p.id = %I.%I
          and p.workspace_id in (select public.current_user_workspace_ids())
      ))
    $p$, spec.child, spec.parent, spec.child, spec.fk);

    execute format($p$
      create policy "membros editam" on %I for update to authenticated
      using (exists (
        select 1 from %I p
        where p.id = %I.%I
          and p.workspace_id in (select public.current_user_workspace_ids())
      ))
      with check (exists (
        select 1 from %I p
        where p.id = %I.%I
          and p.workspace_id in (select public.current_user_workspace_ids())
      ))
    $p$, spec.child, spec.parent, spec.child, spec.fk,
         spec.parent, spec.child, spec.fk);

    execute format($p$
      create policy "membros apagam" on %I for delete to authenticated
      using (exists (
        select 1 from %I p
        where p.id = %I.%I
          and p.workspace_id in (select public.current_user_workspace_ids())
      ))
    $p$, spec.child, spec.parent, spec.child, spec.fk);
  end loop;
end;
$$;

-- transcript_segments: dois níveis abaixo de meetings
alter table transcript_segments enable row level security;

create policy "membros leem" on transcript_segments for select to authenticated
  using (exists (
    select 1 from transcripts t join meetings m on m.id = t.meeting_id
    where t.id = transcript_segments.transcript_id
      and m.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros criam" on transcript_segments for insert to authenticated
  with check (exists (
    select 1 from transcripts t join meetings m on m.id = t.meeting_id
    where t.id = transcript_segments.transcript_id
      and m.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros editam" on transcript_segments for update to authenticated
  using (exists (
    select 1 from transcripts t join meetings m on m.id = t.meeting_id
    where t.id = transcript_segments.transcript_id
      and m.workspace_id in (select public.current_user_workspace_ids())
  ))
  with check (exists (
    select 1 from transcripts t join meetings m on m.id = t.meeting_id
    where t.id = transcript_segments.transcript_id
      and m.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros apagam" on transcript_segments for delete to authenticated
  using (exists (
    select 1 from transcripts t join meetings m on m.id = t.meeting_id
    where t.id = transcript_segments.transcript_id
      and m.workspace_id in (select public.current_user_workspace_ids())
  ));

-- routine_logs: herda de routines
alter table routine_logs enable row level security;

create policy "membros leem" on routine_logs for select to authenticated
  using (exists (
    select 1 from routines r where r.id = routine_logs.routine_id
      and r.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros criam" on routine_logs for insert to authenticated
  with check (exists (
    select 1 from routines r where r.id = routine_logs.routine_id
      and r.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros editam" on routine_logs for update to authenticated
  using (exists (
    select 1 from routines r where r.id = routine_logs.routine_id
      and r.workspace_id in (select public.current_user_workspace_ids())
  ))
  with check (exists (
    select 1 from routines r where r.id = routine_logs.routine_id
      and r.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros apagam" on routine_logs for delete to authenticated
  using (exists (
    select 1 from routines r where r.id = routine_logs.routine_id
      and r.workspace_id in (select public.current_user_workspace_ids())
  ));

-- task_dependencies e task_tags: são tabelas de ligação, então têm DUAS pontas.
-- Validar só o `task_id` deixaria o usuário apontar uma tarefa sua para uma
-- tarefa (ou etiqueta) de outro workspace — a linha ficaria invisível para o
-- outro lado, mas a ligação existiria, e um join inocente atravessaria a
-- fronteira. Cada ponta é checada separadamente.

alter table task_dependencies enable row level security;

create policy "membros leem" on task_dependencies for select to authenticated
  using (exists (
    select 1 from tasks t where t.id = task_dependencies.task_id
      and t.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros criam" on task_dependencies for insert to authenticated
  with check (
    exists (
      select 1 from tasks t where t.id = task_dependencies.task_id
        and t.workspace_id in (select public.current_user_workspace_ids())
    )
    and exists (
      select 1 from tasks t where t.id = task_dependencies.depends_on_id
        and t.workspace_id in (select public.current_user_workspace_ids())
    )
  );

create policy "membros apagam" on task_dependencies for delete to authenticated
  using (exists (
    select 1 from tasks t where t.id = task_dependencies.task_id
      and t.workspace_id in (select public.current_user_workspace_ids())
  ));

alter table task_tags enable row level security;

create policy "membros leem" on task_tags for select to authenticated
  using (exists (
    select 1 from tasks t where t.id = task_tags.task_id
      and t.workspace_id in (select public.current_user_workspace_ids())
  ));

create policy "membros criam" on task_tags for insert to authenticated
  with check (
    exists (
      select 1 from tasks t where t.id = task_tags.task_id
        and t.workspace_id in (select public.current_user_workspace_ids())
    )
    and exists (
      select 1 from tags g where g.id = task_tags.tag_id
        and g.workspace_id in (select public.current_user_workspace_ids())
    )
  );

create policy "membros apagam" on task_tags for delete to authenticated
  using (exists (
    select 1 from tasks t where t.id = task_tags.task_id
      and t.workspace_id in (select public.current_user_workspace_ids())
  ));

-- ---------------------------------------------------------------------------
-- Privilégios da Data API
-- ---------------------------------------------------------------------------
-- RLS decide quais *linhas* aparecem; o GRANT decide se a *tabela* é alcançável
-- pela API REST. São coisas separadas, e dependendo da configuração do projeto
-- tabelas criadas por SQL não são expostas automaticamente. Concedo só a
-- `authenticated`: o DudaPlan não tem nenhuma tela pública, então `anon` não
-- precisa enxergar tabela nenhuma — só o endpoint de login, que é do Auth.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on all tables in schema public from anon;

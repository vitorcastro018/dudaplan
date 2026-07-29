-- Reset do DudaPlan.
--
-- Cole no SQL Editor do Supabase o bloco que você quer. Os três são
-- destrutivos e não têm desfazer — confira que está no projeto certo antes
-- (o do DudaPlan é `drhnfkfdnhxcqzyqbpgc`).
--
-- Não precisa reaplicar migration nenhuma depois: os três preservam o schema,
-- as políticas de RLS e os triggers. Só os dados somem.


-- ===========================================================================
-- 1. Zerar os dados, mantendo as contas
-- ===========================================================================
-- Você continua logado e continua existindo como usuário; perde projetos,
-- tarefas, rotinas, reuniões — e o workspace. Como o workspace some, você
-- ficaria sem associação e o app abriria vazio, então o bloco recria um.
--
-- TRUNCATE ... CASCADE em `workspaces` já derruba todas as tabelas que
-- dependem dela, que são todas menos users e memberships.

truncate table workspaces cascade;

insert into workspaces (name, owner_id)
select coalesce(nullif(btrim(u.name), ''), split_part(u.email, '@', 1)) || ' — DudaPlan', u.id
from users u;

insert into memberships (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner' from workspaces w;


-- ===========================================================================
-- 2. Apagar UMA conta e tudo que é dela
-- ===========================================================================
-- Troque o e-mail. Apagar em auth.users cascateia para public.users, daí para
-- o workspace e daí para todo o resto.
--
-- Isto só funciona a partir da migration 20260728000005: antes dela
-- `workspaces.owner_id` não tinha ON DELETE e o Postgres recusava com
-- "violates foreign key constraint workspaces_owner_id_fkey".

-- delete from auth.users where email = 'troque@pelo-seu-email.com';


-- ===========================================================================
-- 3. Reset total — nenhuma conta, nenhum dado
-- ===========================================================================
-- Volta ao estado logo depois de aplicar as migrations. Você vai precisar
-- criar a conta de novo, pela tela de cadastro do app ou pelo painel.

-- delete from auth.users;


-- ===========================================================================
-- Conferir depois
-- ===========================================================================
-- select
--   (select count(*) from auth.users)   as contas,
--   (select count(*) from users)        as perfis,
--   (select count(*) from workspaces)   as workspaces,
--   (select count(*) from memberships)  as associacoes,
--   (select count(*) from tasks)        as tarefas,
--   (select count(*) from projects)     as projetos,
--   (select count(*) from routines)     as rotinas;
--
-- Depois de qualquer um dos três, cada conta precisa ter exatamente uma
-- associação 'owner'. Sem ela o RLS esconde tudo e o app abre vazio.

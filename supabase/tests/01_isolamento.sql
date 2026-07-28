\set ON_ERROR_STOP off

-- Dois cadastros. O trigger de bootstrap cria perfil + workspace + associação.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com');

select u.email, w.name as workspace, m.role
from public.users u
join public.memberships m on m.user_id = u.id
join public.workspaces w on w.id = m.workspace_id
order by u.email;

-- Dados de cada um, criados como postgres (dono, ignora RLS) só para popular.
insert into projects (workspace_id, name, outcome, status)
select id, 'Projeto da Ana', 'Ana entrega', 'active' from workspaces where owner_id = '11111111-1111-1111-1111-111111111111';
insert into projects (workspace_id, name, outcome, status)
select id, 'Projeto do Bruno', 'Bruno entrega', 'active' from workspaces where owner_id = '22222222-2222-2222-2222-222222222222';

grant authenticated to postgres;

\echo '### 1. Ana enxerga só o próprio projeto'
set role authenticated;
set "test.uid" = '11111111-1111-1111-1111-111111111111';
select name from projects order by name;

\echo '### 2. Bruno enxerga só o dele'
set "test.uid" = '22222222-2222-2222-2222-222222222222';
select name from projects order by name;

\echo '### 3. Bruno NAO pode inserir no workspace da Ana (esperado: 0 rows / violacao)'
insert into projects (workspace_id, name, outcome, status)
select id, 'Invasao', 'x', 'active' from workspaces where owner_id = '11111111-1111-1111-1111-111111111111'
returning name;

\echo '### 4. Bruno NAO consegue apagar/editar o projeto da Ana (esperado: 0 rows)'
update projects set name = 'Sequestrado' where name = 'Projeto da Ana' returning name;
delete from projects where name = 'Projeto da Ana' returning name;

\echo '### 5. Bruno NAO pode mover o proprio projeto para o workspace da Ana (WITH CHECK)'
update projects set workspace_id = (select id from workspaces where owner_id = '11111111-1111-1111-1111-111111111111')
where name = 'Projeto do Bruno' returning name;

\echo '### 6. Bruno le apenas o proprio perfil (ainda nao sao colegas)'
select email from users order by email;

\echo '### 7. Ana adiciona Bruno ao workspace dela'
set "test.uid" = '11111111-1111-1111-1111-111111111111';
insert into memberships (workspace_id, user_id, role)
select id, '22222222-2222-2222-2222-222222222222', 'member' from workspaces where owner_id = '11111111-1111-1111-1111-111111111111'
returning role;

\echo '### 8. Agora Bruno enxerga os dois projetos e os dois perfis'
set "test.uid" = '22222222-2222-2222-2222-222222222222';
select name from projects order by name;
select email from users order by email;

\echo '### 9. Bruno NAO pode se promover a owner (so o dono edita associacoes)'
update memberships m set role = 'owner'
from workspaces w
where m.workspace_id = w.id and w.owner_id = '11111111-1111-1111-1111-111111111111'
  and m.user_id = '22222222-2222-2222-2222-222222222222' returning m.role;

\echo '### 10. Bruno pode sair sozinho do workspace da Ana'
delete from memberships m using workspaces w
where m.workspace_id = w.id and w.owner_id = '11111111-1111-1111-1111-111111111111'
  and m.user_id = '22222222-2222-2222-2222-222222222222' returning m.role;

\echo '### 11. Saindo, Bruno perde o acesso'
select name from projects order by name;

reset role;

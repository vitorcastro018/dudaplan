\set ON_ERROR_STOP off
\set ana '11111111-1111-1111-1111-111111111111'
\set bruno '22222222-2222-2222-2222-222222222222'

-- Dois cadastros. O trigger de bootstrap cria só o perfil.
insert into auth.users (id, email) values
  (:'ana', 'ana@example.com'),
  (:'bruno', 'bruno@example.com');

select email, name from public.users order by email;

-- Dados de cada um, criados como postgres (dono, ignora RLS) só para popular.
insert into projects (user_id, name, problem, outcome, status, deadline_optimistic, deadline_mediocre, deadline_realistic)
values (:'ana', 'Projeto da Ana', 'p', 'Ana entrega', 'active', current_date, current_date, current_date),
       (:'bruno', 'Projeto do Bruno', 'p', 'Bruno entrega', 'active', current_date, current_date, current_date);

grant authenticated to postgres;

\echo '### 1. Ana enxerga só o próprio projeto'
set role authenticated;
set "test.uid" = '11111111-1111-1111-1111-111111111111';
select name from projects order by name;

\echo '### 2. Bruno enxerga só o dele'
set "test.uid" = '22222222-2222-2222-2222-222222222222';
select name from projects order by name;

\echo '### 3. Bruno NAO pode inserir projeto em nome da Ana (esperado: erro de RLS)'
insert into projects (user_id, name, problem, outcome, status, deadline_optimistic, deadline_mediocre, deadline_realistic)
values (:'ana', 'Invasao', 'p', 'x', 'active', current_date, current_date, current_date);

\echo '### 4. Bruno NAO consegue editar/apagar o projeto da Ana (esperado: 0 rows)'
update projects set name = 'Sequestrado' where name = 'Projeto da Ana' returning name;
delete from projects where name = 'Projeto da Ana' returning name;

\echo '### 5. Bruno NAO pode passar o proprio projeto para a Ana (WITH CHECK, esperado: erro)'
update projects set user_id = :'ana' where name = 'Projeto do Bruno' returning name;

\echo '### 6. Cada um le apenas o proprio perfil'
select email from users order by email;

\echo '### 7. Bruno edita o proprio perfil (esperado: 1 row) mas nao o da Ana (0 rows)'
update users set name = 'Bruno B' where id = :'bruno' returning name;
update users set name = 'Hackeada' where id = :'ana' returning name;

reset role;

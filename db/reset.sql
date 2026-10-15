-- Reset do DudaPlan.
--
-- Rode com psql no servidor (veja "Banco de dados" no README):
--
--   docker compose exec -T db psql -U dudaplan -d dudaplan < db/reset.sql
--
-- Os blocos são destrutivos e não têm desfazer — faça um backup antes
-- (README, "Backup"). Descomente só o que quer. Nenhum deles mexe no schema.

-- 1. Zerar os dados, mantendo as contas ------------------------------------
-- Você continua existindo como usuário; perde projetos, tarefas, rotinas e
-- reuniões. Os áudios em disco (/app/data) não são tocados por aqui.

-- truncate table projects, tasks, meetings, routines cascade;

-- 2. Apagar UMA conta e tudo que é dela -------------------------------------
-- Troque o e-mail (minúsculo). Leva sessões, projetos, tarefas, rotinas e
-- reuniões por cascata.

-- delete from users where email = 'troque@pelo-seu-email.com';

-- 3. Reset total — nenhuma conta, nenhum dado -------------------------------
-- Volta ao estado logo depois das migrations. Você cria a conta de novo pela
-- tela de cadastro.

-- truncate table users cascade;

-- Conferir depois ------------------------------------------------------------
-- select (select count(*) from users) as contas,
--        (select count(*) from projects) as projetos,
--        (select count(*) from tasks) as tarefas,
--        (select count(*) from routines) as rotinas;

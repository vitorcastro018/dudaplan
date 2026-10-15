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
-- tarefas, rotinas e reuniões. Não precisa recriar nada: a posse é direta
-- (`user_id`), então o app abre vazio e pronto para uso.

truncate table projects, tasks, meetings, routines cascade;


-- ===========================================================================
-- 2. Apagar UMA conta e tudo que é dela
-- ===========================================================================
-- Troque o e-mail. Apagar em auth.users cascateia para public.users e daí para
-- tudo que tem `user_id` dela.

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
--   (select count(*) from tasks)        as tarefas,
--   (select count(*) from projects)     as projetos,
--   (select count(*) from routines)     as rotinas;
--
-- Depois do reset, `contas` e `perfis` devem ser iguais: o trigger de cadastro
-- cria o perfil de cada conta.

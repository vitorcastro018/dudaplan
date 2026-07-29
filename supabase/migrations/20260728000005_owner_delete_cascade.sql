-- Permite apagar uma conta.
--
-- `workspaces.owner_id` foi criado como `references users(id)` sem cláusula
-- ON DELETE, o que no Postgres significa NO ACTION. Como o trigger de cadastro
-- cria um workspace para todo usuário novo, todo usuário passa a ser dono de
-- pelo menos um — e apagar a conta pelo painel do Supabase falhava com:
--
--   update or delete on table "users" violates foreign key constraint
--   "workspaces_owner_id_fkey" on table "workspaces"
--
-- O caminho é: apagar em auth.users cascateia para public.users (a FK já é
-- ON DELETE CASCADE), e daí precisa cascatear para o workspace. Todas as outras
-- tabelas já referenciam workspaces com ON DELETE CASCADE, então a partir daqui
-- some tudo que era daquela conta — que é a semântica certa num app pessoal:
-- apagar a conta apaga o conteúdo dela.
--
-- `projects.owner_id` continua ON DELETE SET NULL de propósito: ali o dono é
-- uma atribuição dentro de um workspace que sobrevive à saída da pessoa.

alter table workspaces
  drop constraint workspaces_owner_id_fkey;

alter table workspaces
  add constraint workspaces_owner_id_fkey
  foreign key (owner_id) references users(id) on delete cascade;

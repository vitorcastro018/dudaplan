-- Próximos passos extraídos da reunião pela IA, em JSON, para virarem tarefas
-- com um clique. Cada item guarda o id da tarefa criada a partir dele, para a
-- mesma ação não virar tarefa duas vezes.
alter table meetings add column action_items jsonb;
alter table meetings add column action_items_at timestamptz;

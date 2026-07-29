-- Enquadramento do projeto e os três prazos.
--
-- O modelo já exigia `outcome` ("como eu sei que terminou"). Faltava o outro
-- lado da mesma pergunta: por que o projeto existe. `problem` entra obrigatório
-- pelo mesmo motivo que `outcome` (invariante 1) — projeto sem problema
-- declarado é solução à procura de justificativa, e na hora de despriorizar não
-- sobra nada em que apoiar a decisão.
--
-- Os três prazos registram um intervalo em vez de fingir uma data exata:
-- otimista é o caminho sem atrito, realista é a aposta honesta, medíocre é o
-- cenário ruim que ainda assim entrega.
--
-- Nenhuma ordem é imposta entre os três por CHECK. Qual data é maior depende de
-- como cada pessoa usa as três categorias, e um CHECK errado aqui recusaria um
-- cadastro legítimo sem ganho nenhum. A tela mostra a duração de cada prazo em
-- dias, que é o que torna uma ordem estranha visível na hora de preencher.
--
-- `due_date` continua existindo e sai de uso na UI de projetos. Não é apagada
-- aqui de propósito: a coluna é lida por quem quiser um prazo único e removê-la
-- quebraria esse acesso em troca de nada — os três campos novos são a fonte da
-- verdade da tela.
--
-- As colunas entram anuláveis, recebem valor para as linhas que já existirem e
-- só então viram NOT NULL. Depois do reset a tabela está vazia e o UPDATE não
-- toca em nada, mas assim esta migration também roda num banco que já tenha
-- projetos, em vez de falhar com "column contains null values".

alter table projects
  add column problem              text,
  add column deadline_optimistic  date,
  add column deadline_mediocre    date,
  add column deadline_realistic   date;

update projects
set
  problem = 'Não informado (projeto criado antes deste campo existir).',
  -- `due_date` como base quando existe: é a única estimativa que o projeto
  -- tinha, então repeti-la nos três é mais honesto que inventar um intervalo.
  deadline_optimistic = coalesce(due_date, start_date, current_date),
  deadline_mediocre   = coalesce(due_date, start_date, current_date),
  deadline_realistic  = coalesce(due_date, start_date, current_date)
where problem is null;

alter table projects
  alter column problem             set not null,
  alter column deadline_optimistic set not null,
  alter column deadline_mediocre   set not null,
  alter column deadline_realistic  set not null;

alter table projects
  add constraint projects_problem_not_blank
  check (length(btrim(problem)) > 0);

-- A tela lista por prazo realista, que é a aposta que orienta a priorização.
create index on projects (workspace_id, deadline_realistic) where archived_at is null;

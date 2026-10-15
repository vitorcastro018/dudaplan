-- Testes do schema: invariantes de negócio e isolamento entre contas.
--
-- Cada caso é um bloco DO que LANÇA EXCEÇÃO se o comportamento esperado não
-- acontecer — então `psql -v ON_ERROR_STOP=1` falha sozinho (e o CI também),
-- sem ninguém precisar ler a saída. Rodam dentro de uma transação desfeita no
-- fim, para o banco ficar como estava.
--
-- Como rodar: `bash db/tests/run.sh` (veja o README).

\o /dev/null
begin;

create function pg_temp.expect_error(stmt text, fragment text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'ESPERADO erro contendo "%", mas passou: %', fragment, stmt;
exception when others then
  if sqlerrm like 'ESPERADO erro%' then raise; end if;
  if position(fragment in sqlerrm) = 0 then
    raise exception 'erro diferente do esperado (queria "%"): %', fragment, sqlerrm;
  end if;
end;
$$;

insert into users (id, email, name, password_hash) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com', 'Ana', 'x'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com', 'Bruno', 'x');

insert into projects (id, user_id, name, problem, outcome, deadline_optimistic, deadline_mediocre, deadline_realistic)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'Projeto da Ana', 'p', 'o', current_date, current_date, current_date);

-- ---- invariantes de tarefa ------------------------------------------------

select pg_temp.expect_error(
  $$insert into tasks (user_id, title, status) values ('11111111-1111-1111-1111-111111111111', 't', 'waiting')$$,
  'tasks_waiting_needs_reason');

select pg_temp.expect_error(
  $$insert into tasks (user_id, title, status) values ('11111111-1111-1111-1111-111111111111', 't', 'done')$$,
  'tasks_completed_at_matches_status');

select pg_temp.expect_error(
  $$insert into tasks (user_id, title, status, completed_at) values ('11111111-1111-1111-1111-111111111111', 't', 'todo', now())$$,
  'tasks_completed_at_matches_status');

-- caminho feliz: waiting com motivo, done com data
insert into tasks (user_id, title, status, blocked_reason)
values ('11111111-1111-1111-1111-111111111111', 'espera', 'waiting', 'aguardando fulano');
insert into tasks (user_id, title, status, completed_at)
values ('11111111-1111-1111-1111-111111111111', 'feita', 'done', now());

-- ---- invariantes de projeto -----------------------------------------------

select pg_temp.expect_error(
  $$insert into projects (user_id, name, problem, outcome, deadline_optimistic, deadline_mediocre, deadline_realistic)
    values ('11111111-1111-1111-1111-111111111111', 'x', '   ', 'o', current_date, current_date, current_date)$$,
  'projects_problem_check');

select pg_temp.expect_error(
  $$insert into projects (user_id, name, problem, outcome, deadline_optimistic, deadline_mediocre, deadline_realistic)
    values ('11111111-1111-1111-1111-111111111111', 'x', 'p', '', current_date, current_date, current_date)$$,
  'projects_outcome_check');

-- ---- rotinas ---------------------------------------------------------------

insert into routines (id, user_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'R');
insert into routine_logs (routine_id, log_date) values ('bbbbbbbb-0000-0000-0000-000000000001', current_date);

select pg_temp.expect_error(
  $$insert into routine_logs (routine_id, log_date) values ('bbbbbbbb-0000-0000-0000-000000000001', current_date)$$,
  'routine_logs_routine_id_log_date_key');

select pg_temp.expect_error(
  $$insert into routine_logs (routine_id, log_date, completed, skipped)
    values ('bbbbbbbb-0000-0000-0000-000000000001', current_date + 1, true, true)$$,
  'routine_logs_not_completed_and_skipped');

-- ---- isolamento: o banco recusa ligar dados de uma conta ao projeto de outra

select pg_temp.expect_error(
  $$insert into tasks (user_id, title, project_id)
    values ('22222222-2222-2222-2222-222222222222', 'invasão', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'tasks_project_id_user_id_fkey');

select pg_temp.expect_error(
  $$insert into meetings (user_id, title, project_id)
    values ('22222222-2222-2222-2222-222222222222', 'invasão', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'meetings_project_id_user_id_fkey');

-- ---- cascatas --------------------------------------------------------------

insert into meetings (id, user_id, title, project_id)
values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'M',
        'aaaaaaaa-0000-0000-0000-000000000001');
insert into tasks (id, user_id, title, project_id)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'T',
        'aaaaaaaa-0000-0000-0000-000000000001');

delete from projects where id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  -- apagar o projeto solta a reunião (sem apagá-la nem zerar user_id) e leva a tarefa
  if not exists (select 1 from meetings where id = 'cccccccc-0000-0000-0000-000000000001' and project_id is null) then
    raise exception 'a reunião devia sobreviver ao projeto, com project_id nulo';
  end if;
  if exists (select 1 from tasks where id = 'dddddddd-0000-0000-0000-000000000001') then
    raise exception 'a tarefa devia ser apagada junto com o projeto';
  end if;
end;
$$;

-- apagar a conta leva todo o conteúdo
delete from users where id = '11111111-1111-1111-1111-111111111111';

do $$
begin
  if exists (select 1 from tasks) or exists (select 1 from meetings) or exists (select 1 from routines)
     or exists (select 1 from routine_logs) then
    raise exception 'apagar a conta devia apagar tarefas, reuniões e rotinas dela';
  end if;
end;
$$;

rollback;
\o
\echo 'OK: todos os testes de schema passaram.'

\set ON_ERROR_STOP off
\set ana '11111111-1111-1111-1111-111111111111'
select id as aws from workspaces where owner_id = :'ana' \gset
grant authenticated to postgres;
set role authenticated;
set "test.uid" = '11111111-1111-1111-1111-111111111111';

insert into tasks (workspace_id, title, status) values (:'aws','Pai','todo') returning id as p \gset
insert into tasks (workspace_id, title, status, parent_task_id) values (:'aws','Filha','todo',:'p') returning id as c \gset
\echo '### I1. profundidade 2 (neta) -> deve falhar'
insert into tasks (workspace_id, title, status, parent_task_id) values (:'aws','Neta','todo',:'c');
\echo '### I2. tarefa com filhos virando subtarefa -> deve falhar'
insert into tasks (workspace_id, title, status) values (:'aws','Outra','todo') returning id as o \gset
update tasks set parent_task_id = :'o' where id = :'p';
\echo '### I3. subtarefa irma legitima -> deve passar'
insert into tasks (workspace_id, title, status, parent_task_id) values (:'aws','Filha2','todo',:'p') returning title;

\echo '### I4. waiting sem motivo -> deve falhar'
insert into tasks (workspace_id, title, status) values (:'aws','Travada','waiting');
\echo '### I5. done sem completed_at -> deve falhar'
insert into tasks (workspace_id, title, status) values (:'aws','Feita','done');

\echo '### I6. meeting ready sem transcricao/artefato -> deve falhar'
insert into meetings (workspace_id, title, scheduled_at, created_by) values (:'aws','R2',now(),:'ana') returning id as m2 \gset
update meetings set status = 'ready' where id = :'m2';

\echo '### I7. rotina: log duplicado no mesmo dia -> deve falhar'
insert into routines (workspace_id, user_id, name, cadence) values (:'aws',:'ana','R','daily') returning id as r \gset
insert into routine_logs (routine_id, log_date, completed) values (:'r', current_date, true);
insert into routine_logs (routine_id, log_date, completed) values (:'r', current_date, false);
\echo '### I8. log completed E skipped -> deve falhar'
insert into routine_logs (routine_id, log_date, completed, skipped) values (:'r', current_date+1, true, true);
reset role;

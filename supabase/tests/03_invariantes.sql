\set ON_ERROR_STOP off
\set ana '11111111-1111-1111-1111-111111111111'
grant authenticated to postgres;
set role authenticated;
set "test.uid" = '11111111-1111-1111-1111-111111111111';

insert into tasks (user_id, title, status) values (:'ana','Pai','todo') returning id as p \gset
insert into tasks (user_id, title, status, parent_task_id) values (:'ana','Filha','todo',:'p') returning id as c \gset
\echo '### I1. profundidade 2 (neta) -> deve falhar'
insert into tasks (user_id, title, status, parent_task_id) values (:'ana','Neta','todo',:'c');
\echo '### I2. tarefa com filhos virando subtarefa -> deve falhar'
insert into tasks (user_id, title, status) values (:'ana','Outra','todo') returning id as o \gset
update tasks set parent_task_id = :'o' where id = :'p';
\echo '### I3. subtarefa irma legitima -> deve passar'
insert into tasks (user_id, title, status, parent_task_id) values (:'ana','Filha2','todo',:'p') returning title;

\echo '### I4. waiting sem motivo -> deve falhar'
insert into tasks (user_id, title, status) values (:'ana','Travada','waiting');
\echo '### I5. done sem completed_at -> deve falhar'
insert into tasks (user_id, title, status) values (:'ana','Feita','done');

\echo '### I6. rotina: log duplicado no mesmo dia -> deve falhar'
insert into routines (user_id, name, cadence) values (:'ana','R','daily') returning id as r \gset
insert into routine_logs (routine_id, log_date, completed) values (:'r', current_date, true);
insert into routine_logs (routine_id, log_date, completed) values (:'r', current_date, false);
\echo '### I7. log completed E skipped -> deve falhar'
insert into routine_logs (routine_id, log_date, completed, skipped) values (:'r', current_date+1, true, true);

\echo '### I8. projeto sem problema/resultado -> deve falhar'
insert into projects (user_id, name, problem, outcome, deadline_optimistic, deadline_mediocre, deadline_realistic)
values (:'ana','X','  ','y',current_date,current_date,current_date);
reset role;

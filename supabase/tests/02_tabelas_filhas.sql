\set ON_ERROR_STOP off
\set ana '11111111-1111-1111-1111-111111111111'
\set bruno '22222222-2222-2222-2222-222222222222'

-- Cadeia da Ana: reunião -> participante/gravação, rotina -> log, tarefa.
insert into meetings (user_id, title, scheduled_at, created_by)
values (:'ana', 'Reuniao da Ana', now(), :'ana') returning id as mtg \gset
insert into meeting_participants (meeting_id, external_name) values (:'mtg', 'Fulano');
insert into recordings (meeting_id, storage_path, mime_type) values (:'mtg', 'a.webm', 'audio/webm');
insert into routines (user_id, name, cadence) values (:'ana', 'Rotina da Ana', 'daily') returning id as rot \gset
insert into routine_logs (routine_id, log_date, completed) values (:'rot', current_date, true) returning id as rlog \gset
insert into tasks (user_id, title, status) values (:'ana', 'T1', 'todo') returning id as t1 \gset

grant authenticated to postgres;
set role authenticated;

\echo '### A. Bruno nao le nada da cadeia da Ana (tudo 0)'
set "test.uid" = '22222222-2222-2222-2222-222222222222';
select 'meetings' t, count(*) from meetings
union all select 'meeting_participants', count(*) from meeting_participants
union all select 'recordings', count(*) from recordings
union all select 'routines', count(*) from routines
union all select 'routine_logs', count(*) from routine_logs
union all select 'tasks', count(*) from tasks order by 1;

\echo '### B. Bruno tenta inserir em tabelas-filhas da Ana com ID EXPLICITO (esperado: 4 erros de RLS)'
insert into meeting_participants (meeting_id, external_name) values (:'mtg', 'Invasor');
insert into recordings (meeting_id, storage_path, mime_type) values (:'mtg', 'x.webm', 'audio/webm');
insert into routine_logs (routine_id, log_date, completed) values (:'rot', current_date + 1, true);
insert into tasks (user_id, title) values (:'ana', 'Invasao');

\echo '### C. Bruno tenta apagar o log da Ana (esperado: 0 rows)'
delete from routine_logs where id = :'rlog' returning id;

\echo '### D. Ana le a cadeia inteira (tudo 1)'
set "test.uid" = '11111111-1111-1111-1111-111111111111';
select 'meetings' t, count(*) from meetings
union all select 'meeting_participants', count(*) from meeting_participants
union all select 'recordings', count(*) from recordings
union all select 'routine_logs', count(*) from routine_logs
union all select 'tasks', count(*) from tasks order by 1;

\echo '### E. Ana insere na propria cadeia (esperado: sucesso)'
insert into routine_logs (routine_id, log_date, completed) values (:'rot', current_date + 1, true) returning log_date;

\echo '### F. anon nao enxerga nada (sem GRANT)'
set role anon;
select count(*) from projects;

reset role;

\set ON_ERROR_STOP off
\set ana '11111111-1111-1111-1111-111111111111'
\set bruno '22222222-2222-2222-2222-222222222222'

select id as ana_ws from workspaces where owner_id = :'ana' \gset
select id as bruno_ws from workspaces where owner_id = :'bruno' \gset

-- Cadeia completa no workspace da Ana: reunião -> transcrição -> segmento,
-- rotina -> log, e duas tasks com dependência e tag.
insert into meetings (workspace_id, title, scheduled_at, created_by)
values (:'ana_ws', 'Reuniao da Ana', now(), :'ana') returning id as mtg \gset
insert into transcripts (meeting_id, language, full_text)
values (:'mtg', 'pt-BR', 'texto') returning id as tr \gset
insert into transcript_segments (transcript_id, start_ms, end_ms, text)
values (:'tr', 0, 1000, 'ola') returning id as seg \gset
insert into routines (workspace_id, user_id, name, cadence) values (:'ana_ws', :'ana', 'Rotina da Ana', 'daily') returning id as rot \gset
insert into routine_logs (routine_id, log_date, completed) values (:'rot', current_date, true) returning id as rlog \gset
insert into tasks (workspace_id, title, status) values (:'ana_ws','T1','todo') returning id as t1 \gset
insert into tasks (workspace_id, title, status) values (:'ana_ws','T2','todo') returning id as t2 \gset
insert into task_dependencies (task_id, depends_on_id) values (:'t1', :'t2');
insert into tags (workspace_id, name) values (:'ana_ws','urgente') returning id as tag \gset
insert into task_tags (task_id, tag_id) values (:'t1', :'tag');

grant authenticated to postgres;
set role authenticated;

\echo '### A. Bruno (nao-membro) nao le nada da cadeia da Ana'
set "test.uid" = '22222222-2222-2222-2222-222222222222';
select 'meetings' t, count(*) from meetings
union all select 'transcripts', count(*) from transcripts
union all select 'transcript_segments', count(*) from transcript_segments
union all select 'routines', count(*) from routines
union all select 'routine_logs', count(*) from routine_logs
union all select 'task_dependencies', count(*) from task_dependencies
union all select 'task_tags', count(*) from task_tags
union all select 'milestones', count(*) from milestones order by 1;

\echo '### B. Bruno tenta inserir em tabelas-filhas da Ana com ID EXPLICITO (esperado: erro de RLS)'
insert into transcript_segments (transcript_id, start_ms, end_ms, text) values (:'tr', 5000, 6000, 'invasao');
insert into routine_logs (routine_id, log_date, completed) values (:'rot', current_date + 1, true);
insert into task_tags (task_id, tag_id) values (:'t1', :'tag');
insert into task_dependencies (task_id, depends_on_id) values (:'t2', :'t1');

\echo '### C. Bruno tenta inserir projeto no workspace da Ana com ID EXPLICITO (esperado: erro de RLS)'
insert into projects (workspace_id, name, outcome, status) values (:'ana_ws', 'Invasao', 'x', 'active');

\echo '### D. Bruno tenta apagar o segmento da Ana (esperado: 0 rows)'
delete from transcript_segments where id = :'seg';

\echo '### E. Ana le a cadeia inteira'
set "test.uid" = '11111111-1111-1111-1111-111111111111';
select 'meetings' t, count(*) from meetings
union all select 'transcripts', count(*) from transcripts
union all select 'transcript_segments', count(*) from transcript_segments
union all select 'routine_logs', count(*) from routine_logs
union all select 'task_dependencies', count(*) from task_dependencies
union all select 'task_tags', count(*) from task_tags order by 1;

\echo '### F. Ana insere na propria cadeia (esperado: sucesso)'
insert into transcript_segments (transcript_id, start_ms, end_ms, text) values (:'tr', 1000, 2000, 'tudo bem') returning text;

\echo '### G. anon nao enxerga nada (sem GRANT)'
set role anon;
select count(*) from projects;

reset role;

\echo '### H. Bruno NAO liga tarefa sua a tarefa/etiqueta da Ana (ponta estrangeira)'
set role authenticated;
set "test.uid" = '22222222-2222-2222-2222-222222222222';
insert into tasks (workspace_id, title, status) values (:'bruno_ws','T-Bruno','todo') returning id as bt \gset
insert into task_dependencies (task_id, depends_on_id) values (:'bt', :'t1');
insert into task_tags (task_id, tag_id) values (:'bt', :'tag');
\echo '(as duas linhas acima devem falhar por RLS)'
reset role;

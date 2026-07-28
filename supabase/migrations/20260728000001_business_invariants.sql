-- Invariantes da seção 12 que um CHECK não consegue expressar, porque dependem
-- de outras linhas. CHECK só enxerga a linha sendo gravada.
--
-- Todas as funções são SECURITY INVOKER (o padrão): rodam com as permissões de
-- quem disparou, então continuam sujeitas ao RLS. Nenhuma precisa de
-- SECURITY DEFINER, que desligaria o controle de acesso.

-- Invariante 2: subtarefas têm profundidade máxima 1.
-- Uma task não pode ter como pai outra que já tem pai.
create or replace function public.enforce_subtask_depth()
returns trigger
language plpgsql
as $$
declare
  parent_has_parent boolean;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if new.parent_task_id = new.id then
    raise exception 'Uma tarefa não pode ser subtarefa de si mesma.';
  end if;

  select parent_task_id is not null into parent_has_parent
  from tasks where id = new.parent_task_id;

  if parent_has_parent then
    raise exception 'Subtarefas têm profundidade máxima 1: a tarefa pai já é uma subtarefa.';
  end if;

  -- Impede que uma task com filhos vire subtarefa (criaria profundidade 2 por trás).
  if exists (select 1 from tasks where parent_task_id = new.id) then
    raise exception 'Esta tarefa já tem subtarefas, então não pode virar subtarefa.';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_subtask_depth
  before insert or update of parent_task_id on tasks
  for each row execute function public.enforce_subtask_depth();

-- Invariante 6: ai_suggestion só transiciona a partir de 'pending'. Nunca volta.
create or replace function public.enforce_ai_suggestion_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status and old.status <> 'pending' then
    raise exception
      'Sugestão de IA já resolvida como "%": o estado não pode mudar novamente.', old.status;
  end if;
  return new;
end;
$$;

create trigger ai_suggestions_enforce_transition
  before update on ai_suggestions
  for each row execute function public.enforce_ai_suggestion_transition();

-- Invariante 8: meeting.status só chega a 'ready' com transcript e ao menos um artefato.
create or replace function public.enforce_meeting_ready()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'ready' then
    return new;
  end if;

  if not exists (select 1 from transcripts where meeting_id = new.id) then
    raise exception 'Reunião não pode ficar "ready" sem transcrição.';
  end if;

  if not exists (select 1 from meeting_artifacts where meeting_id = new.id) then
    raise exception 'Reunião não pode ficar "ready" sem ao menos um artefato gerado.';
  end if;

  return new;
end;
$$;

create trigger meetings_enforce_ready
  before update of status on meetings
  for each row execute function public.enforce_meeting_ready();

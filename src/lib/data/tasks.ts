import { query } from "@/lib/db";
import { todayKey, dayRangeUtc } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { NO_PROJECT } from "@/features/tasks/filters";
import type { TaskRow } from "@/lib/types";

// Tudo que não está concluído nem cancelado nem arquivado. É o recorte que o
// índice parcial de `tasks` cobre, então a visão "Hoje" não varre a tabela.
const OPEN = `status in ('backlog','todo','in_progress','waiting') and archived_at is null`;

const TASK_FIELDS =
  "id, project_id, client_id, title, status, priority, energy, scheduled_date, due_date, blocked_reason, estimate_minutes, position, completed_at, created_at";

export type TaskListItem = Pick<
  TaskRow,
  | "id"
  | "project_id"
  | "client_id"
  | "title"
  | "status"
  | "priority"
  | "energy"
  | "scheduled_date"
  | "due_date"
  | "blocked_reason"
  | "estimate_minutes"
  | "position"
  | "completed_at"
  | "created_at"
>;

export interface TodayBoard {
  today: string;
  overdue: TaskListItem[];
  todayTasks: TaskListItem[];
  completedToday: TaskListItem[];
}

/** As três listas da tela "Hoje". */
export async function getTodayBoard(): Promise<TodayBoard> {
  const userId = await requireUser();
  const today = todayKey();
  const { start, end } = dayRangeUtc(today);

  const [overdue, todayTasks, completedToday] = await Promise.all([
    // Atrasada é a agendada para antes de hoje ou vencida antes de hoje. O
    // `or` cobre tarefa sem agenda mas com prazo estourado, que de outro jeito
    // sumiria da tela justo quando mais importa.
    query<TaskListItem>(
      `select ${TASK_FIELDS} from tasks
        where user_id = $1 and ${OPEN} and (scheduled_date < $2 or due_date < $2)
        order by due_date`,
      [userId, today],
    ),
    query<TaskListItem>(
      `select ${TASK_FIELDS} from tasks
        where user_id = $1 and ${OPEN} and scheduled_date = $2
        order by position`,
      [userId, today],
    ),
    query<TaskListItem>(
      `select ${TASK_FIELDS} from tasks
        where user_id = $1 and status = 'done' and completed_at >= $2 and completed_at < $3
        order by completed_at desc`,
      [userId, start, end],
    ),
  ]);

  return { today, overdue, todayTasks, completedToday };
}

/**
 * Todas as tarefas, para a tela /tarefas.
 *
 * O filtro por projeto vai na consulta, e não numa passada em memória: a tela
 * cresce sem limite e trazer tudo para descartar quase tudo é desperdício que
 * só aparece quando já dói. `is null` e não `= null` — em SQL `= NULL` nunca é
 * verdadeiro e a lista voltaria sempre vazia.
 *
 * Concluídas por último, o resto por posição, que é o que a pessoa arruma. Não
 * ordeno por `status`: a ordem alfabética dos valores põe 'backlog' e
 * 'cancelled' na frente de 'in_progress'.
 */
export async function listTasks(projectId?: string): Promise<TaskListItem[]> {
  const userId = await requireUser();

  const params: unknown[] = [userId];
  let filter = "";
  if (projectId === NO_PROJECT) {
    filter = "and project_id is null";
  } else if (projectId) {
    params.push(projectId);
    filter = "and project_id = $2";
  }

  return query<TaskListItem>(
    `select ${TASK_FIELDS} from tasks
      where user_id = $1 and archived_at is null ${filter}
      order by completed_at asc nulls first, position, created_at`,
    params,
  );
}

export async function listProjectTasks(projectId: string): Promise<TaskListItem[]> {
  const userId = await requireUser();
  return query<TaskListItem>(
    `select ${TASK_FIELDS} from tasks
      where user_id = $1 and project_id = $2 and archived_at is null
      order by status, position`,
    [userId, projectId],
  );
}

/**
 * As tarefas de um cliente: as ligadas direto a ele e as dos projetos dele.
 * `client_id` da tarefa já é herdado do projeto na criação, mas projeto que
 * trocou de cliente depois deixa tarefas com o vínculo antigo — por isso o `or`.
 */
export async function listClientTasks(clientId: string): Promise<TaskListItem[]> {
  const userId = await requireUser();
  return query<TaskListItem>(
    `select ${TASK_FIELDS} from tasks
      where user_id = $1 and archived_at is null
        and (client_id = $2
             or project_id in (select id from projects where client_id = $2 and user_id = $1))
      order by completed_at asc nulls first, position, created_at`,
    [userId, clientId],
  );
}

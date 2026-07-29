import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import { todayKey, dayRangeUtc } from "@/lib/date";
import { NO_PROJECT } from "@/features/tasks/filters";
import type { TaskRow } from "@/lib/supabase/types";

// Tudo que não está concluído nem cancelado nem arquivado. É o recorte que o
// índice parcial de `tasks` cobre, então a visão "Hoje" não varre a tabela.
const OPEN_STATUSES = ["backlog", "todo", "in_progress", "waiting"] as const;

// Uma string literal só, sem concatenar: o supabase-js infere o formato da
// linha a partir do texto do `select`, e `"a" + "b"` colapsa para `string`,
// levando o retorno a `GenericStringError` em vez das colunas pedidas.
const TASK_FIELDS =
  "id, workspace_id, project_id, title, status, priority, energy, scheduled_date, due_date, blocked_reason, estimate_minutes, position, completed_at, created_at";

export type TaskListItem = Pick<
  TaskRow,
  | "id"
  | "workspace_id"
  | "project_id"
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

/**
 * As três listas da tela "Hoje".
 *
 * Não filtro por workspace aqui de propósito: o RLS já restringe a leitura aos
 * workspaces do usuário. Repetir o filtro na query só esconderia uma política
 * quebrada — se algum dia o RLS falhar, quero ver o vazamento no teste, não um
 * filtro de aplicação disfarçando o problema.
 */
export async function getTodayBoard(): Promise<TodayBoard> {
  const supabase = await createClient();
  const today = todayKey();
  const { start, end } = dayRangeUtc(today);

  // Uma função, e não uma variável com o builder pronto: os métodos de filtro do
  // supabase-js mutam o builder e devolvem `this`. Reaproveitar a mesma
  // instância nas três consultas acumularia os filtros de uma na outra.
  const open = () =>
    supabase.from("tasks").select(TASK_FIELDS).in("status", OPEN_STATUSES).is("archived_at", null);

  const [overdue, todayTasks, completedToday] = await Promise.all([
    // Atrasada é a agendada para antes de hoje ou vencida antes de hoje. O
    // `or` cobre tarefa sem agenda mas com prazo estourado, que de outro jeito
    // sumiria da tela justo quando mais importa.
    open().or(`scheduled_date.lt.${today},due_date.lt.${today}`).order("due_date"),
    open().eq("scheduled_date", today).order("position"),
    supabase
      .from("tasks")
      .select(TASK_FIELDS)
      .eq("status", "done")
      .gte("completed_at", start)
      .lt("completed_at", end)
      .order("completed_at", { ascending: false }),
  ]);

  for (const result of [overdue, todayTasks, completedToday]) {
    if (result.error) throw new ApiError(500, "today_query_failed", result.error.message);
  }

  return {
    today,
    overdue: (overdue.data ?? []) as TaskListItem[],
    todayTasks: (todayTasks.data ?? []) as TaskListItem[],
    completedToday: (completedToday.data ?? []) as TaskListItem[],
  };
}

/**
 * Todas as tarefas do workspace, para a tela /tarefas.
 *
 * O filtro por projeto vai na consulta, e não numa passada em memória: a tela
 * cresce sem limite e trazer tudo para descartar quase tudo é desperdício que
 * só aparece quando já dói. `is("project_id", null)` e não `eq(..., null)` —
 * em SQL `= NULL` nunca é verdadeiro e a lista voltaria sempre vazia.
 *
 * Sem `.order("status")`: a ordem alfabética dos valores põe 'backlog' e
 * 'cancelled' na frente de 'in_progress'. Concluídas por último, o resto por
 * posição, que é o que a pessoa arruma.
 */
export async function listTasks(projectId?: string): Promise<TaskListItem[]> {
  const supabase = await createClient();

  let query = supabase.from("tasks").select(TASK_FIELDS).is("archived_at", null);

  if (projectId === NO_PROJECT) query = query.is("project_id", null);
  else if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query
    .order("completed_at", { nullsFirst: true })
    .order("position")
    .order("created_at");

  if (error) throw new ApiError(500, "task_list_failed", error.message);
  return (data ?? []) as TaskListItem[];
}

export async function listProjectTasks(projectId: string): Promise<TaskListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("status")
    .order("position");

  if (error) throw new ApiError(500, "task_list_failed", error.message);
  return (data ?? []) as TaskListItem[];
}

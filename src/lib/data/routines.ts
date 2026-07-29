import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import { todayKey } from "@/lib/date";
import type { RoutineRow } from "@/lib/supabase/types";

export type RoutineListItem = Pick<
  RoutineRow,
  | "id"
  | "workspace_id"
  | "name"
  | "description"
  | "cadence"
  | "active_days"
  | "shift"
  | "link"
  | "target_time"
  | "position"
> & { done: boolean; skipped: boolean };

export interface RoutineBoard {
  date: string;
  routines: RoutineListItem[];
}

/**
 * As rotinas do dia, já com o log daquele dia embutido.
 *
 * Duas consultas em vez de um join: `routine_logs` tem no máximo uma linha por
 * rotina por dia (índice único em `(routine_id, log_date)`), então o cruzamento
 * é um Map — e assim rotina sem log ainda aparece, que é o caso mais comum.
 */
export async function getRoutineBoard(date = todayKey()): Promise<RoutineBoard> {
  const supabase = await createClient();

  const [routines, logs] = await Promise.all([
    supabase
      .from("routines")
      .select(
        "id, workspace_id, name, description, cadence, active_days, shift, link, target_time, position",
      )
      .is("archived_at", null)
      .order("position")
      .order("created_at"),
    supabase.from("routine_logs").select("routine_id, completed, skipped").eq("log_date", date),
  ]);

  if (routines.error) throw new ApiError(500, "routine_list_failed", routines.error.message);
  if (logs.error) throw new ApiError(500, "routine_log_failed", logs.error.message);

  const logByRoutine = new Map((logs.data ?? []).map((log) => [log.routine_id, log]));

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

  return {
    date,
    routines: (routines.data ?? [])
      // `active_days` guarda os dias da semana em que a rotina vale (0 = domingo).
      // Nulo significa "todo dia" — filtrar aqui e não no banco porque a lista é
      // curta e o filtro depende do dia sendo consultado.
      .filter((routine) => {
        if (routine.cadence === "daily") return true;
        if (routine.cadence === "weekdays") return weekday >= 1 && weekday <= 5;
        if (!routine.active_days || routine.active_days.length === 0) return true;
        return routine.active_days.includes(weekday);
      })
      .map((routine) => ({
        ...routine,
        done: logByRoutine.get(routine.id)?.completed ?? false,
        skipped: logByRoutine.get(routine.id)?.skipped ?? false,
      })) as RoutineListItem[],
  };
}

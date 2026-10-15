import { query } from "@/lib/db";
import { todayKey } from "@/lib/date";
import { requireUser } from "@/lib/session";
import type { RoutineRow } from "@/lib/types";

export type RoutineListItem = Pick<
  RoutineRow,
  | "id"
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
  const userId = await requireUser();

  const [routines, logs] = await Promise.all([
    query<Omit<RoutineListItem, "done" | "skipped">>(
      `select id, name, description, cadence, active_days, shift, link, target_time, position
         from routines
        where user_id = $1 and archived_at is null
        order by position, created_at`,
      [userId],
    ),
    query<{ routine_id: string; completed: boolean; skipped: boolean }>(
      `select l.routine_id, l.completed, l.skipped
         from routine_logs l join routines r on r.id = l.routine_id
        where r.user_id = $1 and l.log_date = $2`,
      [userId, date],
    ),
  ]);

  const logByRoutine = new Map(logs.map((log) => [log.routine_id, log]));

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

  return {
    date,
    routines: routines
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
      })),
  };
}

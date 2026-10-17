"use server";

import { revalidatePath } from "next/cache";
import { query, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { todayKey, isValidDateKey } from "@/lib/date";
import { errorMessage } from "@/lib/utils";
import { createRoutineSchema, updateRoutineSchema } from "@/lib/validation/routines";
import type { ActionResult } from "@/lib/actions/tasks";
import type { RoutineRow } from "@/lib/types";

/** Os dias marcados chegam do formulário como vários campos de mesmo nome. */
function readActiveDays(formData: FormData): number[] {
  return formData
    .getAll("activeDays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
}

export async function createRoutine(formData: FormData): Promise<ActionResult> {
  const parsed = createRoutineSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    cadence: formData.get("cadence") || undefined,
    activeDays: readActiveDays(formData),
    shift: formData.get("shift") || null,
    link: formData.get("link") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  try {
    await query(
      `insert into routines (user_id, name, description, cadence, active_days, shift, link)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        parsed.data.name,
        parsed.data.description ?? null,
        parsed.data.cadence,
        // Só "personalizada" usa a lista. Gravar dias numa rotina diária deixaria um
        // valor mentiroso na coluna, esperando alguém mudar a cadência e se
        // surpreender com dias que nunca escolheu.
        parsed.data.cadence === "custom" ? (parsed.data.activeDays ?? null) : null,
        parsed.data.shift ?? null,
        parsed.data.link,
      ],
    );
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

export async function updateRoutine(routineId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateRoutineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  // `Partial<RoutineRow>` e não `Record<string, unknown>`, como no `updateTask`:
  // nome de coluna errado vira erro de compilação, não update vazio.
  const patch: Partial<RoutineRow> = {};
  const { data } = parsed;

  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.shift !== undefined) patch.shift = data.shift;
  if (data.link !== undefined) patch.link = data.link;

  if (data.cadence !== undefined) {
    patch.cadence = data.cadence;
    patch.active_days = data.cadence === "custom" ? (data.activeDays ?? null) : null;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  try {
    await updateOwned("routines", routineId, userId, patch);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

/**
 * Marca ou desmarca a rotina no dia.
 *
 * `upsert` com conflito em `(routine_id, log_date)`: o índice único do schema
 * garante um log por rotina por dia, então marcar duas vezes atualiza a mesma
 * linha em vez de duplicar. A idempotência é do banco, não da UI — dois cliques
 * rápidos, ou a mesma tela aberta em dois lugares, não criam log duplicado.
 */
export async function toggleRoutine(
  routineId: string,
  done: boolean,
  date = todayKey(),
): Promise<ActionResult> {
  if (!isValidDateKey(date)) return { ok: false, error: "Data inválida." };

  const userId = await requireUser();

  try {
    // O `where exists` é a checagem de posse: o log só entra se a rotina for
    // desta conta. Sem ele, qualquer id de rotina serviria.
    await query(
      `insert into routine_logs (routine_id, log_date, completed, skipped)
       select r.id, $2, $3, false from routines r where r.id = $1 and r.user_id = $4
       on conflict (routine_id, log_date)
       do update set completed = excluded.completed, skipped = excluded.skipped`,
      [routineId, date, done, userId],
    );
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

export async function archiveRoutine(routineId: string): Promise<ActionResult> {
  const userId = await requireUser();

  try {
    await updateOwned("routines", routineId, userId, { archived_at: new Date().toISOString() });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

function revalidate() {
  revalidatePath("/rotinas");
  revalidatePath("/hoje");
}

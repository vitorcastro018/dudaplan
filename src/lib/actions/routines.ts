"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/workspace";
import { todayKey, isValidDateKey } from "@/lib/date";
import { createRoutineSchema, updateRoutineSchema } from "@/lib/validation/routines";
import type { ActionResult } from "@/lib/actions/tasks";
import type { RoutineRow } from "@/lib/supabase/types";

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

  const { workspaceId, userId } = await requireContext();
  const supabase = await createClient();

  const { error } = await supabase.from("routines").insert({
    workspace_id: workspaceId,
    user_id: userId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    cadence: parsed.data.cadence,
    // Só "personalizada" usa a lista. Gravar dias numa rotina diária deixaria um
    // valor mentiroso na coluna, esperando alguém mudar a cadência e se
    // surpreender com dias que nunca escolheu.
    active_days: parsed.data.cadence === "custom" ? (parsed.data.activeDays ?? null) : null,
    shift: parsed.data.shift ?? null,
    link: parsed.data.link,
  });

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function updateRoutine(routineId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateRoutineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireContext();
  const supabase = await createClient();

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

  const { error } = await supabase.from("routines").update(patch).eq("id", routineId);
  if (error) return { ok: false, error: error.message };

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

  await requireContext();
  const supabase = await createClient();

  const { error } = await supabase.from("routine_logs").upsert(
    {
      routine_id: routineId,
      log_date: date,
      completed: done,
      // O CHECK `routine_logs_not_completed_and_skipped` recusa as duas marcas
      // ao mesmo tempo, então concluir sempre limpa o "pulei".
      skipped: false,
    },
    { onConflict: "routine_id,log_date" },
  );

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function archiveRoutine(routineId: string): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("routines")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", routineId);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

function revalidate() {
  revalidatePath("/rotinas");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/workspace";
import { todayKey, isValidDateKey } from "@/lib/date";
import type { ActionResult } from "@/lib/actions/tasks";

const createRoutineSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à rotina.").max(200),
  description: z.string().trim().max(500).nullable().optional(),
  cadence: z.enum(["daily", "weekdays", "weekly", "custom"]).default("daily"),
});

export async function createRoutine(formData: FormData): Promise<ActionResult> {
  const parsed = createRoutineSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    cadence: formData.get("cadence") || undefined,
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
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/rotinas");
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

  revalidatePath("/rotinas");
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

  revalidatePath("/rotinas");
  return { ok: true };
}

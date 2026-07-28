"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/workspace";
import { isValidDateKey } from "@/lib/date";
import type { ActionResult } from "@/lib/actions/tasks";

const dateKey = z
  .string()
  .refine(isValidDateKey, "Data inválida (esperado AAAA-MM-DD).")
  .nullable()
  .optional();

export const projectStatusSchema = z.enum(["planning", "active", "on_hold", "done", "cancelled"]);

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao projeto.").max(200),
  // Obrigatório por decisão do modelo (invariante 1): um projeto sem critério
  // de conclusão nunca termina. O banco recusa vazio, então peço aqui também,
  // com uma mensagem que explica o porquê em vez de repetir a regra.
  outcome: z.string().trim().min(1, "Descreva como você saberá que o projeto terminou.").max(500),
  status: projectStatusSchema.default("active"),
  startDate: dateKey,
  dueDate: dateKey,
});

export async function createProject(formData: FormData): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    outcome: formData.get("outcome"),
    status: formData.get("status") || undefined,
    startDate: formData.get("startDate") || null,
    dueDate: formData.get("dueDate") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { workspaceId, userId } = await requireContext();
  const supabase = await createClient();

  const { error } = await supabase.from("projects").insert({
    workspace_id: workspaceId,
    owner_id: userId,
    name: parsed.data.name,
    outcome: parsed.data.outcome,
    status: parsed.data.status,
    start_date: parsed.data.startDate ?? null,
    due_date: parsed.data.dueDate ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/projetos");
  return { ok: true };
}

export async function archiveProject(projectId: string): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/projetos");
  revalidatePath("/hoje");
  return { ok: true };
}

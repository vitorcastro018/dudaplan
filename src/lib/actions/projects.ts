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

// Sem `export`: num arquivo "use server" todo export é tratado como Server
// Function, e um objeto Zod não é função. Nada importava este schema — ele só é
// usado logo abaixo, no mesmo arquivo.
const projectStatusSchema = z.enum(["planning", "active", "on_hold", "done", "cancelled"]);

// Prazo obrigatório: mesmo formato do `dateKey` acima, mas sem `.nullable()`
// nem `.optional()`, e com mensagem própria — "Required" não diz qual dos três
// faltou, e os três chegam juntos no mesmo formulário.
const requiredDateKey = (label: string) =>
  z
    .string({ error: `Escolha o ${label}.` })
    .min(1, `Escolha o ${label}.`)
    .refine(isValidDateKey, "Data inválida (esperado AAAA-MM-DD).");

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao projeto.").max(200),
  // Obrigatório pelo mesmo motivo do `outcome`: projeto sem problema declarado
  // é solução à procura de justificativa, e depois não há em que apoiar a
  // decisão de despriorizar.
  problem: z.string().trim().min(1, "Descreva o problema que o projeto resolve.").max(1000),
  // Obrigatório por decisão do modelo (invariante 1): um projeto sem critério
  // de conclusão nunca termina. O banco recusa vazio, então peço aqui também,
  // com uma mensagem que explica o porquê em vez de repetir a regra.
  outcome: z.string().trim().min(1, "Descreva como você saberá que o projeto terminou.").max(500),
  status: projectStatusSchema.default("active"),
  startDate: dateKey,
  // Sem validação de ordem entre os três, pelo mesmo motivo de não haver CHECK
  // no banco: qual data é maior depende de como cada pessoa usa as categorias.
  deadlineOptimistic: requiredDateKey("prazo otimista"),
  deadlineMediocre: requiredDateKey("prazo medíocre"),
  deadlineRealistic: requiredDateKey("prazo realista"),
});

export async function createProject(formData: FormData): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    problem: formData.get("problem"),
    outcome: formData.get("outcome"),
    status: formData.get("status") || undefined,
    startDate: formData.get("startDate") || null,
    deadlineOptimistic: formData.get("deadlineOptimistic") ?? "",
    deadlineMediocre: formData.get("deadlineMediocre") ?? "",
    deadlineRealistic: formData.get("deadlineRealistic") ?? "",
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
    problem: parsed.data.problem,
    outcome: parsed.data.outcome,
    status: parsed.data.status,
    start_date: parsed.data.startDate ?? null,
    deadline_optimistic: parsed.data.deadlineOptimistic,
    deadline_mediocre: parsed.data.deadlineMediocre,
    deadline_realistic: parsed.data.deadlineRealistic,
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

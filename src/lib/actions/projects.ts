"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/workspace";
import { isValidDateKey } from "@/lib/date";
import type { ActionResult } from "@/lib/actions/tasks";
import type { ProjectRow } from "@/lib/supabase/types";

/** Como `ActionResult`, mas devolve o id — quem cria de dentro de outro
 *  formulário (a tela de reuniões) precisa dele para já selecionar o projeto. */
export type CreateProjectResult = { ok: true; id: string } | { ok: false; error: string };

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

const nameField = z.string().trim().min(1, "Dê um nome ao projeto.").max(200);
// Obrigatório pelo mesmo motivo do `outcome`: projeto sem problema declarado
// é solução à procura de justificativa, e depois não há em que apoiar a
// decisão de despriorizar.
const problemField = z
  .string()
  .trim()
  .min(1, "Descreva o problema que o projeto resolve.")
  .max(1000);
// Obrigatório por decisão do modelo (invariante 1): um projeto sem critério
// de conclusão nunca termina. O banco recusa vazio, então peço aqui também,
// com uma mensagem que explica o porquê em vez de repetir a regra.
const outcomeField = z
  .string()
  .trim()
  .min(1, "Descreva como você saberá que o projeto terminou.")
  .max(500);

const createProjectSchema = z.object({
  name: nameField,
  problem: problemField,
  outcome: outcomeField,
  status: projectStatusSchema.default("active"),
  startDate: dateKey,
  // Sem validação de ordem entre os três, pelo mesmo motivo de não haver CHECK
  // no banco: qual data é maior depende de como cada pessoa usa as categorias.
  deadlineOptimistic: requiredDateKey("prazo otimista"),
  deadlineMediocre: requiredDateKey("prazo medíocre"),
  deadlineRealistic: requiredDateKey("prazo realista"),
});

// Construído do zero, e não `createProjectSchema.partial()`: o `.partial()`
// preserva os `.default()`, então um update que não mencionasse `status`
// receberia "active" e sobrescreveria em silêncio o valor que já estava lá.
// Mesma armadilha documentada em `src/lib/validation/tasks.ts`.
const updateProjectSchema = z.object({
  name: nameField.optional(),
  problem: problemField.optional(),
  outcome: outcomeField.optional(),
  status: projectStatusSchema.optional(),
  startDate: dateKey,
  deadlineOptimistic: requiredDateKey("prazo otimista").optional(),
  deadlineMediocre: requiredDateKey("prazo medíocre").optional(),
  deadlineRealistic: requiredDateKey("prazo realista").optional(),
});

function revalidate() {
  revalidatePath("/projetos", "layout");
  revalidatePath("/hoje");
  revalidatePath("/tarefas");
  // O nome do projeto aparece na lista e no formulário de reuniões.
  revalidatePath("/reunioes", "layout");
}

function readProjectForm(formData: FormData) {
  return {
    name: formData.get("name"),
    problem: formData.get("problem"),
    outcome: formData.get("outcome"),
    status: formData.get("status") || undefined,
    startDate: formData.get("startDate") || null,
    deadlineOptimistic: formData.get("deadlineOptimistic") ?? "",
    deadlineMediocre: formData.get("deadlineMediocre") ?? "",
    deadlineRealistic: formData.get("deadlineRealistic") ?? "",
  };
}

export async function createProject(formData: FormData): Promise<CreateProjectResult> {
  const parsed = createProjectSchema.safeParse(readProjectForm(formData));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { workspaceId, userId } = await requireContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
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
    })
    // O `select` depois do insert volta pelo RLS de leitura, que o criador
    // satisfaz — é o mesmo workspace que o `with check` acabou de aprovar.
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true, id: data.id };
}

export async function updateProject(projectId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireContext();
  const supabase = await createClient();

  // `Partial<ProjectRow>` e não `Record<string, unknown>`, pela mesma razão do
  // `updateTask`: erro de digitação em nome de coluna vira erro de compilação
  // em vez de um update silenciosamente vazio.
  const patch: Partial<ProjectRow> = {};
  const { data } = parsed;

  if (data.name !== undefined) patch.name = data.name;
  if (data.problem !== undefined) patch.problem = data.problem;
  if (data.outcome !== undefined) patch.outcome = data.outcome;
  if (data.startDate !== undefined) patch.start_date = data.startDate;
  if (data.deadlineOptimistic !== undefined) patch.deadline_optimistic = data.deadlineOptimistic;
  if (data.deadlineMediocre !== undefined) patch.deadline_mediocre = data.deadlineMediocre;
  if (data.deadlineRealistic !== undefined) patch.deadline_realistic = data.deadlineRealistic;

  if (data.status !== undefined) {
    patch.status = data.status;
    // `completed_at` acompanha o status, como em `tasks`. Aqui não há CHECK
    // exigindo isso, mas deixar a data de conclusão preenchida num projeto que
    // voltou a ser ativo é registro errado.
    patch.completed_at = data.status === "done" ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidate();
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

  revalidate();
  return { ok: true };
}

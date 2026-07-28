"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/workspace";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation/tasks";
import { shiftDateKey, todayKey } from "@/lib/date";
import type { TaskRow, TaskStatus } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/hoje");
  revalidatePath("/projetos", "layout");
}

/**
 * Traduz o erro do Postgres para algo que se possa ler na tela.
 *
 * Os CHECK do schema são a última linha de defesa, não a primeira — a UI já
 * impede cada um deles. Se um chegar aqui é bug, e a mensagem crua do Postgres
 * ("violates check constraint tasks_waiting_needs_reason") não ajuda ninguém.
 */
function describeError(message: string): string {
  if (message.includes("tasks_waiting_needs_reason")) {
    return "Para deixar a tarefa aguardando é preciso dizer o motivo.";
  }
  if (message.includes("tasks_completed_at_matches_status")) {
    return "Estado inconsistente entre conclusão e data de conclusão.";
  }
  if (message.includes("profundidade máxima")) {
    return "Subtarefas só podem ter um nível.";
  }
  return message;
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    projectId: formData.get("projectId") || null,
    scheduledDate: formData.get("scheduledDate") || null,
    priority: formData.get("priority") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { workspaceId } = await requireContext();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    title: parsed.data.title,
    project_id: parsed.data.projectId ?? null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    scheduled_date: parsed.data.scheduledDate ?? null,
    due_date: parsed.data.dueDate ?? null,
  });

  if (error) return { ok: false, error: describeError(error.message) };

  revalidate();
  return { ok: true };
}

/**
 * Conclui ou reabre.
 *
 * `completed_at` anda junto com o status por exigência do banco: o CHECK
 * `tasks_completed_at_matches_status` diz que a data existe se e somente se o
 * status é 'done'. Mandar só o status faz o UPDATE ser recusado.
 */
export async function setTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      status: (done ? "done" : "todo") satisfies TaskStatus,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: describeError(error.message) };

  revalidate();
  return { ok: true };
}

export async function updateTask(taskId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireContext();
  const supabase = await createClient();

  // `Partial<TaskRow>` e não `Record<string, unknown>`: o segundo passa
  // qualquer chave, então um erro de digitação em nome de coluna viraria um
  // update silenciosamente vazio em vez de erro de compilação.
  const patch: Partial<TaskRow> = {};
  const { data } = parsed;

  if (data.title !== undefined) patch.title = data.title;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.energy !== undefined) patch.energy = data.energy;
  if (data.projectId !== undefined) patch.project_id = data.projectId;
  if (data.scheduledDate !== undefined) patch.scheduled_date = data.scheduledDate;
  if (data.dueDate !== undefined) patch.due_date = data.dueDate;
  if (data.estimateMinutes !== undefined) patch.estimate_minutes = data.estimateMinutes;
  if (data.blockedReason !== undefined) patch.blocked_reason = data.blockedReason;

  if (data.status !== undefined) {
    patch.status = data.status;
    // Mesmo acoplamento do setTaskDone: mudar para/de 'done' por aqui também
    // precisa acertar completed_at, senão o CHECK recusa.
    if (data.status === "done") patch.completed_at = new Date().toISOString();
    else patch.completed_at = null;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: describeError(error.message) };

  revalidate();
  return { ok: true };
}

/** Empurra para amanhã a partir de hoje, não a partir da data atual da tarefa —
 *  reagendar uma tarefa atrasada de três dias tem que trazê-la para amanhã. */
export async function snoozeTaskToTomorrow(taskId: string): Promise<ActionResult> {
  return updateTask(taskId, { scheduledDate: shiftDateKey(todayKey(), 1) });
}

export async function scheduleTaskForToday(taskId: string): Promise<ActionResult> {
  return updateTask(taskId, { scheduledDate: todayKey() });
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: describeError(error.message) };

  revalidate();
  return { ok: true };
}

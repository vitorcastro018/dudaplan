"use server";

import { revalidatePath } from "next/cache";
import { query, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation/tasks";
import { shiftDateKey, todayKey } from "@/lib/date";
import type { TaskRow, TaskStatus } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/hoje");
  revalidatePath("/tarefas");
  revalidatePath("/projetos", "layout");
  revalidatePath("/clientes", "layout");
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
    clientId: formData.get("clientId") || null,
    scheduledDate: formData.get("scheduledDate") || null,
    priority: formData.get("priority") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  try {
    await query(
      // Sem cliente explícito, a tarefa de um projeto herda o cliente dele.
      `insert into tasks
         (user_id, title, project_id, client_id, status, priority, scheduled_date, due_date)
       values ($1, $2, $3,
               coalesce($8::uuid, (select client_id from projects where id = $3 and user_id = $1)),
               $4, $5, $6, $7)`,
      [
        userId,
        parsed.data.title,
        parsed.data.projectId ?? null,
        parsed.data.status,
        parsed.data.priority,
        parsed.data.scheduledDate ?? null,
        parsed.data.dueDate ?? null,
        parsed.data.clientId ?? null,
      ],
    );
  } catch (error) {
    return { ok: false, error: describeError(errorMessage(error)) };
  }

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
  const userId = await requireUser();

  try {
    await updateOwned("tasks", taskId, userId, {
      status: (done ? "done" : "todo") satisfies TaskStatus,
      completed_at: done ? new Date().toISOString() : null,
    });
  } catch (error) {
    return { ok: false, error: describeError(errorMessage(error)) };
  }

  revalidate();
  return { ok: true };
}

export async function updateTask(taskId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  // `Partial<TaskRow>` e não `Record<string, unknown>`: o segundo passa
  // qualquer chave, então um erro de digitação em nome de coluna viraria um
  // update silenciosamente vazio em vez de erro de compilação.
  const patch: Partial<TaskRow> = {};
  const { data } = parsed;

  if (data.title !== undefined) patch.title = data.title;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.energy !== undefined) patch.energy = data.energy;
  if (data.projectId !== undefined) patch.project_id = data.projectId;
  if (data.clientId !== undefined) patch.client_id = data.clientId;
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

  try {
    await updateOwned("tasks", taskId, userId, patch);
  } catch (error) {
    return { ok: false, error: describeError(errorMessage(error)) };
  }

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

/**
 * Liga (ou desliga) a tarefa de um projeto.
 *
 * `null` desanexa. Passa por `updateTask` para herdar a validação de UUID: sem
 * ela um id inventado chegaria ao banco e voltaria como erro de foreign key,
 * cru, na cara da pessoa.
 */
export async function setTaskProject(
  taskId: string,
  projectId: string | null,
): Promise<ActionResult> {
  return updateTask(taskId, { projectId });
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const userId = await requireUser();

  try {
    await query("delete from tasks where id = $1 and user_id = $2", [taskId, userId]);
  } catch (error) {
    return { ok: false, error: describeError(errorMessage(error)) };
  }

  revalidate();
  return { ok: true };
}

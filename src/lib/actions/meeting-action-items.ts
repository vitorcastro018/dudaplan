"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne, transaction, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { todayKey } from "@/lib/date";
import { resolveAudioPath } from "@/lib/storage/audio";
import { getMeetingRecording } from "@/lib/data/meetings";
import { AiError, extractActionItems, transcribeAudio } from "@/lib/ai/openai";
import { parseActionItems, parseAiActionItems, type ActionItem } from "@/lib/ai/action-items";
import type { ActionResult } from "@/lib/actions/tasks";
import type { MeetingRow } from "@/lib/types";

function revalidate() {
  revalidatePath("/reunioes", "layout");
  revalidatePath("/hoje");
  revalidatePath("/tarefas");
  revalidatePath("/projetos", "layout");
  revalidatePath("/clientes", "layout");
}

/**
 * Extrai os próximos passos da reunião e guarda a lista nela.
 *
 * Reaproveita a transcrição já salva; só transcreve o áudio se ainda não houver
 * uma. Gerar de novo troca os itens que ainda não viraram tarefa e mantém os que
 * já viraram — e avisa a IA deles, para não os repetir.
 */
export async function generateActionItems(meetingId: string): Promise<ActionResult> {
  const userId = await requireUser();

  const meeting = await queryOne<
    Pick<MeetingRow, "id" | "title" | "notes" | "transcript" | "action_items">
  >(
    "select id, title, notes, transcript, action_items from meetings where id = $1 and user_id = $2",
    [meetingId, userId],
  );
  if (!meeting) return { ok: false, error: "Reunião não encontrada." };

  try {
    let transcript = meeting.transcript;

    if (!transcript) {
      const recording = await getMeetingRecording(meetingId);
      if (!recording) {
        return { ok: false, error: "Envie ou grave um áudio antes de gerar as tarefas." };
      }
      transcript = await transcribeAudio(
        resolveAudioPath(recording.storage_path),
        recording.mime_type,
        recording.size_bytes ?? 0,
      );
      if (!transcript) {
        return { ok: false, error: "Não foi possível entender fala nesse áudio." };
      }
      await updateOwned("meetings", meetingId, userId, { transcript });
    }

    const participants = (
      await query<{ name: string }>("select name from meeting_participants where meeting_id = $1", [
        meetingId,
      ])
    )
      .map((row) => row.name)
      .filter(Boolean);

    const created = parseActionItems(meeting.action_items).filter((item) => item.taskId);

    const raw = await extractActionItems({
      title: meeting.title,
      participants,
      notes: meeting.notes,
      transcript,
      today: todayKey(),
      alreadyCreated: created.map((item) => item.title),
    });

    const found = parseAiActionItems(raw);
    if (!found) {
      return {
        ok: false,
        error: "A IA devolveu os passos fora do formato esperado. Tente de novo.",
      };
    }

    const items: ActionItem[] = [
      ...created,
      ...found.map((item) => ({ ...item, id: randomUUID(), taskId: null })),
    ];

    await updateOwned("meetings", meetingId, userId, {
      action_items: JSON.stringify(items),
      action_items_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: `Não foi possível gerar as tarefas: ${errorMessage(error)}` };
  }

  revalidate();
  return { ok: true };
}

const selectionSchema = z
  .array(z.object({ id: z.string().min(1), title: z.string().trim().min(1).max(300) }))
  .min(1, "Escolha ao menos uma tarefa.")
  .max(50);

/**
 * Cria as tarefas dos itens escolhidos (com o título que a pessoa deixou).
 *
 * Tudo numa transação, com a linha da reunião travada: dois cliques seguidos, ou
 * duas abas, não criam a mesma tarefa duas vezes — o segundo vê o `taskId` já
 * preenchido e pula o item. A tarefa herda o projeto e o cliente da reunião.
 */
export async function createTasksFromActionItems(
  meetingId: string,
  selection: { id: string; title: string }[],
): Promise<ActionResult> {
  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  try {
    const total = await transaction(async (client) => {
      const meeting = (
        await client.query<Pick<MeetingRow, "project_id" | "client_id" | "action_items">>(
          `select project_id, client_id, action_items from meetings
            where id = $1 and user_id = $2 for update`,
          [meetingId, userId],
        )
      ).rows[0];
      if (!meeting) throw new AiError("Reunião não encontrada.");

      const items = parseActionItems(meeting.action_items);
      const titles = new Map(parsed.data.map((entry) => [entry.id, entry.title]));
      let count = 0;

      for (const item of items) {
        const title = titles.get(item.id);
        if (!title || item.taskId) continue;

        const inserted = await client.query<{ id: string }>(
          // Sem cliente na reunião, a tarefa de um projeto herda o cliente dele.
          `insert into tasks
             (user_id, title, project_id, client_id, status, priority, due_date)
           values ($1, $2, $3,
                   coalesce($4::uuid, (select client_id from projects where id = $3 and user_id = $1)),
                   'todo', $5, $6)
           returning id`,
          [userId, title, meeting.project_id, meeting.client_id, item.priority, item.dueDate],
        );
        item.taskId = inserted.rows[0].id;
        count += 1;
      }

      await client.query("update meetings set action_items = $1 where id = $2 and user_id = $3", [
        JSON.stringify(items),
        meetingId,
        userId,
      ]);
      return count;
    });

    if (total === 0) return { ok: false, error: "Essas tarefas já foram criadas." };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: `Não foi possível criar as tarefas: ${errorMessage(error)}` };
  }

  revalidate();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { query, queryOne, transaction, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { localDateTimeToUtcIso } from "@/lib/date";
import { errorMessage } from "@/lib/utils";
import { deleteMeetingAudioDir } from "@/lib/storage/audio";
import { createMeetingSchema, updateMeetingSchema } from "@/lib/validation/meetings";
import type { ActionResult } from "@/lib/actions/tasks";
import type { MeetingRow } from "@/lib/types";

export type CreateMeetingResult = { ok: true; id: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/reunioes", "layout");
  revalidatePath("/clientes", "layout");
  revalidatePath("/hoje");
}

function readForm(formData: FormData) {
  return {
    title: formData.get("title"),
    scheduledAt: formData.get("scheduledAt") || null,
    projectId: formData.get("projectId") || null,
    clientId: formData.get("clientId") || null,
    notes: formData.get("notes") || null,
    participants: formData.get("participants") || null,
  };
}

/**
 * Regrava a lista de participantes da reunião.
 *
 * Apagar e reinserir, em vez de conciliar quem entrou e quem saiu: os
 * participantes são só nomes soltos, sem nada pendurado neles, então não há o
 * que preservar — e conciliação seria código para manter sem ganho nenhum.
 * Roda dentro da transação do chamador, para a lista nunca ficar pela metade.
 */
async function replaceParticipants(client: PoolClient, meetingId: string, names: string[]) {
  await client.query("delete from meeting_participants where meeting_id = $1", [meetingId]);
  if (names.length === 0) return;

  await client.query(
    "insert into meeting_participants (meeting_id, name) select $1, unnest($2::text[])",
    [meetingId, names],
  );
}

export async function createMeeting(formData: FormData): Promise<CreateMeetingResult> {
  const parsed = createMeetingSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  try {
    const id = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        // Sem cliente explícito, a reunião de um projeto herda o cliente dele.
        `insert into meetings (user_id, title, project_id, client_id, notes, scheduled_at)
         values ($1, $2, $3,
                 coalesce($6::uuid, (select client_id from projects where id = $3 and user_id = $1)),
                 $4, $5) returning id`,
        [
          userId,
          parsed.data.title,
          parsed.data.projectId ?? null,
          parsed.data.notes ?? null,
          parsed.data.scheduledAt ? localDateTimeToUtcIso(parsed.data.scheduledAt) : null,
          parsed.data.clientId ?? null,
        ],
      );
      const meetingId = created.rows[0].id;
      await replaceParticipants(client, meetingId, parsed.data.participants);
      return meetingId;
    });

    revalidate();
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateMeeting(meetingId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  // `Partial<MeetingRow>` e não `Record<string, unknown>`, como nas outras
  // actions: nome de coluna errado vira erro de compilação.
  const patch: Partial<MeetingRow> = {};
  const { data } = parsed;

  if (data.title !== undefined) patch.title = data.title;
  if (data.projectId !== undefined) patch.project_id = data.projectId;
  if (data.clientId !== undefined) patch.client_id = data.clientId;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.scheduledAt !== undefined) {
    patch.scheduled_at = data.scheduledAt ? localDateTimeToUtcIso(data.scheduledAt) : null;
  }

  try {
    // Só mexe nos participantes de uma reunião que é desta conta.
    const owned = await queryOne("select 1 from meetings where id = $1 and user_id = $2", [
      meetingId,
      userId,
    ]);
    if (!owned) return { ok: false, error: "Reunião não encontrada." };

    await updateOwned("meetings", meetingId, userId, patch);

    // A lista de participantes é sempre reenviada pelo formulário, inclusive
    // vazia — que é como se remove todo mundo.
    await transaction((client) => replaceParticipants(client, meetingId, parsed.data.participants));
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

/**
 * Apaga a reunião e o áudio dela.
 *
 * O `on delete cascade` do schema leva participantes e gravação. O arquivo em disco não está no banco e não some sozinho — sem esta
 * chamada, cada reunião apagada deixaria um diretório órfão no volume.
 */
export async function deleteMeeting(meetingId: string): Promise<ActionResult> {
  const userId = await requireUser();

  try {
    const deleted = await query(
      "delete from meetings where id = $1 and user_id = $2 returning id",
      [meetingId, userId],
    );
    // Só apaga o diretório do áudio se a reunião era desta conta; senão
    // qualquer id conhecido apagaria o áudio de outra pessoa.
    if (deleted.length > 0) await deleteMeetingAudioDir(meetingId);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

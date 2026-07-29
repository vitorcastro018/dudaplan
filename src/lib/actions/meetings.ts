"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/workspace";
import { localDateTimeToUtcIso } from "@/lib/date";
import { deleteMeetingAudioDir } from "@/lib/storage/audio";
import { createMeetingSchema, updateMeetingSchema } from "@/lib/validation/meetings";
import type { ActionResult } from "@/lib/actions/tasks";
import type { MeetingRow } from "@/lib/supabase/types";

export type CreateMeetingResult = { ok: true; id: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/reunioes", "layout");
}

function readForm(formData: FormData) {
  return {
    title: formData.get("title"),
    scheduledAt: formData.get("scheduledAt") || null,
    projectId: formData.get("projectId") || null,
    notes: formData.get("notes") || null,
    participants: formData.get("participants") || null,
  };
}

/**
 * Regrava a lista de participantes da reunião.
 *
 * Apagar e reinserir, em vez de conciliar quem entrou e quem saiu: os
 * participantes hoje são só nomes soltos em `external_name`, sem nada pendurado
 * neles, então não há o que preservar — e conciliação seria código para manter
 * sem ganho nenhum. O `unique (meeting_id, speaker_label)` não atrapalha:
 * `speaker_label` fica nulo, e o Postgres trata nulos como distintos entre si.
 */
async function replaceParticipants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingId: string,
  names: string[],
): Promise<string | null> {
  const { error: deleteError } = await supabase
    .from("meeting_participants")
    .delete()
    .eq("meeting_id", meetingId);

  if (deleteError) return deleteError.message;
  if (names.length === 0) return null;

  const { error } = await supabase
    .from("meeting_participants")
    .insert(names.map((name) => ({ meeting_id: meetingId, external_name: name })));

  return error?.message ?? null;
}

export async function createMeeting(formData: FormData): Promise<CreateMeetingResult> {
  const parsed = createMeetingSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { workspaceId, userId } = await requireContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      title: parsed.data.title,
      project_id: parsed.data.projectId ?? null,
      notes: parsed.data.notes ?? null,
      scheduled_at: parsed.data.scheduledAt ? localDateTimeToUtcIso(parsed.data.scheduledAt) : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const participantsError = await replaceParticipants(supabase, data.id, parsed.data.participants);
  if (participantsError) return { ok: false, error: participantsError };

  revalidate();
  return { ok: true, id: data.id };
}

export async function updateMeeting(meetingId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireContext();
  const supabase = await createClient();

  // `Partial<MeetingRow>` e não `Record<string, unknown>`, como nas outras
  // actions: nome de coluna errado vira erro de compilação.
  const patch: Partial<MeetingRow> = {};
  const { data } = parsed;

  if (data.title !== undefined) patch.title = data.title;
  if (data.projectId !== undefined) patch.project_id = data.projectId;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.scheduledAt !== undefined) {
    patch.scheduled_at = data.scheduledAt ? localDateTimeToUtcIso(data.scheduledAt) : null;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("meetings").update(patch).eq("id", meetingId);
    if (error) return { ok: false, error: error.message };
  }

  // A lista de participantes é sempre reenviada pelo formulário, inclusive
  // vazia — que é como se remove todo mundo.
  const participantsError = await replaceParticipants(
    supabase,
    meetingId,
    parsed.data.participants,
  );
  if (participantsError) return { ok: false, error: participantsError };

  revalidate();
  return { ok: true };
}

/**
 * Apaga a reunião e o áudio dela.
 *
 * O `on delete cascade` do schema leva participantes, gravação, transcrição e
 * artefatos. O arquivo em disco não está no banco e não some sozinho — sem esta
 * chamada, cada reunião apagada deixaria um diretório órfão no volume.
 */
export async function deleteMeeting(meetingId: string): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();

  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) return { ok: false, error: error.message };

  await deleteMeetingAudioDir(meetingId);

  revalidate();
  return { ok: true };
}

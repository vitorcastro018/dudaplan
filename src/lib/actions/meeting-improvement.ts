"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { resolveAudioPath } from "@/lib/storage/audio";
import { getMeetingRecording } from "@/lib/data/meetings";
import { AiError, suggestProcessImprovement, transcribeAudio } from "@/lib/ai/openai";
import { parseImprovement } from "@/lib/ai/improvement";
import type { ActionResult } from "@/lib/actions/tasks";
import type { MeetingRow } from "@/lib/types";

/**
 * Gera a sugestão de melhoria de processo da reunião e a guarda nela.
 *
 * Reaproveita a transcrição que o resumo já salvou; só transcreve o áudio se
 * ainda não houver uma. Clicar de novo regenera de propósito.
 */
export async function generateProcessImprovement(meetingId: string): Promise<ActionResult> {
  const userId = await requireUser();

  const meeting = await queryOne<Pick<MeetingRow, "id" | "title" | "notes" | "transcript">>(
    "select id, title, notes, transcript from meetings where id = $1 and user_id = $2",
    [meetingId, userId],
  );
  if (!meeting) return { ok: false, error: "Reunião não encontrada." };

  try {
    let transcript = meeting.transcript;

    if (!transcript) {
      const recording = await getMeetingRecording(meetingId);
      if (!recording) {
        return { ok: false, error: "Envie ou grave um áudio antes de gerar a sugestão." };
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

    const raw = await suggestProcessImprovement({
      title: meeting.title,
      participants,
      notes: meeting.notes,
      transcript,
    });

    const improvement = parseImprovement(raw);
    if (!improvement) {
      return {
        ok: false,
        error: "A IA devolveu a sugestão fora do formato esperado. Tente de novo.",
      };
    }

    await updateOwned("meetings", meetingId, userId, {
      improvement: JSON.stringify(improvement),
      improved_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: `Não foi possível gerar a sugestão: ${errorMessage(error)}` };
  }

  revalidatePath("/reunioes", "layout");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { resolveAudioPath } from "@/lib/storage/audio";
import { getMeetingRecording } from "@/lib/data/meetings";
import { AiError, summarizeTranscript, transcribeAudio } from "@/lib/ai/openai";
import type { ActionResult } from "@/lib/actions/tasks";
import type { MeetingRow } from "@/lib/types";

/**
 * Transcreve o áudio da reunião, resume e guarda os dois na reunião.
 *
 * Chamada só quando a pessoa clica: o resultado fica salvo e a tela o reabre sem
 * gastar a API de novo. Clicar outra vez regenera (e paga outra vez) de
 * propósito — é o que "Gerar novamente" promete.
 */
export async function generateMeetingSummary(meetingId: string): Promise<ActionResult> {
  const userId = await requireUser();

  const meeting = await queryOne<Pick<MeetingRow, "id" | "title" | "notes">>(
    "select id, title, notes from meetings where id = $1 and user_id = $2",
    [meetingId, userId],
  );
  if (!meeting) return { ok: false, error: "Reunião não encontrada." };

  const recording = await getMeetingRecording(meetingId);
  if (!recording) {
    return { ok: false, error: "Envie ou grave um áudio antes de gerar o resumo." };
  }

  try {
    const transcript = await transcribeAudio(
      resolveAudioPath(recording.storage_path),
      recording.mime_type,
      recording.size_bytes ?? 0,
    );
    if (!transcript) {
      return { ok: false, error: "Não foi possível entender fala nesse áudio." };
    }

    const participants = (
      await query<{ name: string }>("select name from meeting_participants where meeting_id = $1", [
        meetingId,
      ])
    )
      .map((row) => row.name)
      .filter(Boolean);

    const summary = await summarizeTranscript({
      title: meeting.title,
      participants,
      notes: meeting.notes,
      transcript,
    });

    await updateOwned("meetings", meetingId, userId, {
      transcript,
      summary,
      summarized_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: `Não foi possível gerar o resumo: ${errorMessage(error)}` };
  }

  revalidatePath("/reunioes", "layout");
  return { ok: true };
}

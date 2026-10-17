import { query, queryOne, updateOwned } from "@/lib/db";
import { resolveAudioPath } from "@/lib/storage/audio";
import { getMeetingRecording } from "@/lib/data/meetings";
import { transcribeAudio } from "@/lib/ai/openai";
import type { MeetingRow } from "@/lib/types";

export type MeetingAiInput =
  | {
      ok: true;
      meeting: Pick<MeetingRow, "id" | "title" | "notes" | "action_items">;
      transcript: string;
      participants: string[];
    }
  | { ok: false; error: string };

/**
 * O que toda ação de IA da reunião precisa: a reunião, a transcrição e os
 * participantes. Reaproveita a transcrição já salva; só transcreve o áudio se
 * ainda não houver uma, e a guarda para as próximas. Pode lançar `AiError`.
 *
 * `missingAudio` é a mensagem de cada ação para a reunião sem áudio ("...antes
 * de gerar o resumo", "...a sugestão" etc.).
 */
export async function getMeetingAiInput(
  meetingId: string,
  userId: string,
  missingAudio: string,
): Promise<MeetingAiInput> {
  const meeting = await queryOne<
    Pick<MeetingRow, "id" | "title" | "notes" | "transcript" | "action_items">
  >(
    "select id, title, notes, transcript, action_items from meetings where id = $1 and user_id = $2",
    [meetingId, userId],
  );
  if (!meeting) return { ok: false, error: "Reunião não encontrada." };

  let transcript = meeting.transcript;

  if (!transcript) {
    const recording = await getMeetingRecording(meetingId);
    if (!recording) return { ok: false, error: missingAudio };

    transcript = await transcribeAudio(
      resolveAudioPath(recording.storage_path),
      recording.mime_type,
      recording.size_bytes ?? 0,
    );
    if (!transcript) return { ok: false, error: "Não foi possível entender fala nesse áudio." };

    await updateOwned("meetings", meetingId, userId, { transcript });
  }

  const participants = (
    await query<{ name: string }>("select name from meeting_participants where meeting_id = $1", [
      meetingId,
    ])
  )
    .map((row) => row.name)
    .filter(Boolean);

  return { ok: true, meeting, transcript, participants };
}

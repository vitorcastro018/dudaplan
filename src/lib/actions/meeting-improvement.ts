"use server";

import { revalidatePath } from "next/cache";
import { updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { AiError, suggestProcessImprovement } from "@/lib/ai/openai";
import { getMeetingAiInput } from "@/lib/ai/meeting-input";
import { parseImprovement } from "@/lib/ai/improvement";
import type { ActionResult } from "@/lib/actions/tasks";

/**
 * Gera a sugestão de melhoria de processo da reunião e a guarda nela.
 *
 * Reaproveita a transcrição que o resumo já salvou; só transcreve o áudio se
 * ainda não houver uma. Clicar de novo regenera de propósito.
 */
export async function generateProcessImprovement(meetingId: string): Promise<ActionResult> {
  const userId = await requireUser();

  try {
    const input = await getMeetingAiInput(
      meetingId,
      userId,
      "Envie ou grave um áudio antes de gerar a sugestão.",
    );
    if (!input.ok) return input;

    const raw = await suggestProcessImprovement({
      title: input.meeting.title,
      participants: input.participants,
      notes: input.meeting.notes,
      transcript: input.transcript,
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

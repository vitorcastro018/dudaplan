"use server";

import { revalidatePath } from "next/cache";
import { updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { AiError, diagnoseProcess } from "@/lib/ai/openai";
import { getMeetingAiInput } from "@/lib/ai/meeting-input";
import { parseAiDiagnosis } from "@/lib/ai/diagnosis";
import type { ActionResult } from "@/lib/actions/tasks";

/**
 * Gera o diagnóstico de gargalos da reunião e o guarda nela. Clicar de novo
 * regenera de propósito. As citações são conferidas contra a transcrição antes
 * de salvar (ver `parseAiDiagnosis`).
 */
export async function generateDiagnosis(meetingId: string): Promise<ActionResult> {
  const userId = await requireUser();

  try {
    const input = await getMeetingAiInput(
      meetingId,
      userId,
      "Envie ou grave um áudio antes de gerar o diagnóstico.",
    );
    if (!input.ok) return input;

    const raw = await diagnoseProcess({
      title: input.meeting.title,
      participants: input.participants,
      notes: input.meeting.notes,
      transcript: input.transcript,
    });

    const diagnosis = parseAiDiagnosis(raw, input.transcript);
    if (!diagnosis) {
      return {
        ok: false,
        error: "A IA devolveu o diagnóstico fora do formato esperado. Tente de novo.",
      };
    }

    await updateOwned("meetings", meetingId, userId, {
      diagnosis: JSON.stringify(diagnosis),
      diagnosed_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: `Não foi possível gerar o diagnóstico: ${errorMessage(error)}` };
  }

  revalidatePath("/reunioes", "layout");
  return { ok: true };
}

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { resolveAudioPath } from "@/lib/storage/audio";
import { transcribeMeetingAudio } from "./transcribe";
import { analyzeMeetingTranscript } from "./analyze";
import { generateMeetingFlowchart } from "./flowchart";

const STUCK_THRESHOLD_MS = 30 * 60 * 1000;

export async function reconcileStuckMeetings() {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  await prisma.meeting.updateMany({
    where: {
      status: { in: ["TRANSCRIBING", "ANALYZING"] },
      processingStartedAt: { lt: cutoff },
    },
    data: { status: "FAILED", errorMessage: "Processamento interrompido inesperadamente." },
  });
}

export async function runMeetingPipeline(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { project: true },
  });
  if (!meeting) return;

  try {
    let transcript = meeting.transcript;

    if (!transcript) {
      if (!meeting.audioPath || !meeting.audioSizeBytes) {
        throw new Error("Áudio da reunião não encontrado.");
      }
      const absolutePath = resolveAudioPath(meeting.audioPath);
      const promptContext = [meeting.project.name, meeting.title, meeting.participants.join(", ")]
        .filter(Boolean)
        .join(" - ");

      const result = await transcribeMeetingAudio(
        absolutePath,
        meeting.audioSizeBytes,
        promptContext,
      );
      transcript = result.text;

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcript,
          transcribeModel: result.model,
          transcriptLanguage: "pt",
          status: "ANALYZING",
        },
      });
    }

    const { analysis, promptTokens, completionTokens } = await analyzeMeetingTranscript({
      projectName: meeting.project.name,
      projectDescription: meeting.project.description,
      meetingTitle: meeting.title,
      meetingDate: meeting.meetingDate.toISOString(),
      participants: meeting.participants,
      contextNotes: meeting.contextNotes,
      transcript,
    });

    const flowchart = await generateMeetingFlowchart({
      summaryMarkdown: analysis.summaryMarkdown,
      problems: analysis.problems,
      actionPlan: analysis.actionPlan,
    });

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summaryMarkdown: analysis.summaryMarkdown,
        decisions: analysis.decisions,
        problems: analysis.problems,
        actionPlan: analysis.actionPlan,
        risks: analysis.risks,
        flowchartMermaid: flowchart.mermaid,
        flowchartTitle: flowchart.title,
        analysisModel: env.OPENAI_ANALYSIS_MODEL,
        promptTokens,
        completionTokens,
        status: "COMPLETED",
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido.",
      },
    });
  }
}

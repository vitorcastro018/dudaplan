import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "./client";
import { env } from "@/lib/env";
import { meetingAnalysisSchema, type MeetingAnalysis } from "./schemas";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserPrompt } from "./prompts";

const MAX_TRANSCRIPT_CHARS = 350_000;

export interface AnalysisResult {
  analysis: MeetingAnalysis;
  promptTokens: number | null;
  completionTokens: number | null;
}

export async function analyzeMeetingTranscript(input: {
  projectName: string;
  projectDescription: string | null;
  meetingTitle: string;
  meetingDate: string;
  participants: string[];
  contextNotes: string | null;
  transcript: string;
}): Promise<AnalysisResult> {
  const transcript =
    input.transcript.length > MAX_TRANSCRIPT_CHARS
      ? input.transcript.slice(0, MAX_TRANSCRIPT_CHARS)
      : input.transcript;

  const response = await openai.responses.parse({
    model: env.OPENAI_ANALYSIS_MODEL,
    instructions: ANALYSIS_SYSTEM_PROMPT,
    input: buildAnalysisUserPrompt({ ...input, transcript }),
    temperature: 0.2,
    text: { format: zodTextFormat(meetingAnalysisSchema, "analise_reuniao") },
  });

  if (!response.output_parsed) {
    throw new Error("A IA não retornou uma análise válida da reunião.");
  }

  return {
    analysis: response.output_parsed,
    promptTokens: response.usage?.input_tokens ?? null,
    completionTokens: response.usage?.output_tokens ?? null,
  };
}

import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "./client";
import { env } from "@/lib/env";
import { flowchartResponseSchema } from "./schemas";
import {
  FLOWCHART_SYSTEM_PROMPT,
  buildFlowchartUserPrompt,
  buildFlowchartRetryPrompt,
} from "./prompts";

export function validateMermaid(code: string): string | null {
  const trimmed = code.trim();

  if (!/^(flowchart|graph)\b/.test(trimmed)) {
    return "O código não começa com 'flowchart' ou 'graph'.";
  }
  if (trimmed.split("\n").length > 200) {
    return "O diagrama tem mais de 200 linhas.";
  }

  const pairs: [string, string][] = [
    ["[", "]"],
    ["(", ")"],
    ["{", "}"],
  ];
  for (const [open, close] of pairs) {
    const opens = trimmed.split(open).length - 1;
    const closes = trimmed.split(close).length - 1;
    if (opens !== closes) {
      return `Delimitadores desbalanceados: "${open}" (${opens}) vs "${close}" (${closes}).`;
    }
  }
  const quotes = trimmed.split('"').length - 1;
  if (quotes % 2 !== 0) {
    return "Aspas duplas desbalanceadas.";
  }

  return null;
}

function stripCodeFences(code: string): string {
  return code
    .trim()
    .replace(/^```(?:mermaid)?\n?/, "")
    .replace(/```$/, "")
    .trim();
}

async function requestFlowchart(userPrompt: string) {
  const response = await openai.responses.parse({
    model: env.OPENAI_ANALYSIS_MODEL,
    instructions: FLOWCHART_SYSTEM_PROMPT,
    input: userPrompt,
    temperature: 0.2,
    text: { format: zodTextFormat(flowchartResponseSchema, "fluxograma") },
  });

  if (!response.output_parsed) {
    throw new Error("A IA não retornou um fluxograma válido.");
  }

  return {
    title: response.output_parsed.title,
    mermaid: stripCodeFences(response.output_parsed.mermaid),
  };
}

export async function generateMeetingFlowchart(input: {
  summaryMarkdown: string;
  problems: unknown;
  actionPlan: unknown;
}): Promise<{ title: string; mermaid: string }> {
  const first = await requestFlowchart(buildFlowchartUserPrompt(input));

  const error = validateMermaid(first.mermaid);
  if (!error) return first;

  const retry = await requestFlowchart(buildFlowchartRetryPrompt(first.mermaid, error));
  return retry;
}

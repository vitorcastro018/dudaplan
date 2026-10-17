import { openAsBlob } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

const API = "https://api.openai.com/v1";

/** Limite da OpenAI para o arquivo de transcrição. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

/** Erro com mensagem já pronta para a tela. */
export class AiError extends Error {}

function apiKey(): string {
  if (!env.OPENAI_API_KEY) {
    throw new AiError("Falta configurar a OPENAI_API_KEY no servidor para gerar resumos.");
  }
  return env.OPENAI_API_KEY;
}

/** A OpenAI responde `{ error: { message } }`; sem isso o usuário veria só "400". */
async function failure(response: Response): Promise<AiError> {
  let detail = "";
  try {
    const body = await response.json();
    if (typeof body?.error?.message === "string") detail = body.error.message;
  } catch {
    // corpo não-JSON: fica só o status
  }

  if (response.status === 401) return new AiError("A chave da OpenAI foi recusada (401).");
  if (response.status === 429) {
    return new AiError("A OpenAI recusou por limite de uso ou falta de crédito (429). " + detail);
  }
  return new AiError(`A OpenAI respondeu ${response.status}. ${detail}`.trim());
}

/** Transcreve o arquivo de áudio em disco. Lido como `Blob` de arquivo, sem carregar tudo na memória. */
export async function transcribeAudio(
  absolutePath: string,
  mimeType: string,
  sizeBytes: number,
): Promise<string> {
  const key = apiKey();

  if (sizeBytes > MAX_TRANSCRIBE_BYTES) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
    throw new AiError(
      `O áudio tem ${mb} MB e a OpenAI aceita no máximo 25 MB. Anexe um arquivo menor ou comprimido.`,
    );
  }

  const blob = await openAsBlob(absolutePath, { type: mimeType });
  const form = new FormData();
  form.append("file", blob, path.basename(absolutePath));
  form.append("model", env.OPENAI_TRANSCRIBE_MODEL);
  // O app é em português; dizer o idioma evita o modelo "adivinhar" errado em
  // trechos curtos ou com sotaque.
  form.append("language", "pt");
  form.append("response_format", "text");

  const response = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!response.ok) throw await failure(response);

  return (await response.text()).trim();
}

const SYSTEM_PROMPT = `Você resume reuniões a partir da transcrição do áudio. Escreva em português do Brasil, em Markdown, de forma objetiva e fiel ao que foi dito — não invente fatos, nomes, números ou prazos. Se algo não estiver claro na transcrição, diga que não ficou claro.

Use exatamente estas seções, omitindo as que não tiverem conteúdo:

## Resumo
Um parágrafo curto com o assunto e o resultado da reunião.

## Pontos principais
Lista dos tópicos discutidos.

## Decisões
Lista do que ficou decidido.

## Próximos passos
Lista de ações, com responsável e prazo quando foram mencionados.`;

export async function summarizeTranscript(input: {
  title: string;
  participants: string[];
  notes: string | null;
  transcript: string;
}): Promise<string> {
  const key = apiKey();

  const context = [
    `Título da reunião: ${input.title}`,
    input.participants.length > 0 ? `Participantes: ${input.participants.join(", ")}` : null,
    input.notes ? `Anotações feitas pelo usuário:\n${input.notes}` : null,
    `Transcrição:\n${input.transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_SUMMARY_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
    }),
  });
  if (!response.ok) throw await failure(response);

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new AiError("A OpenAI não devolveu um resumo. Tente de novo.");
  }
  return text.trim();
}

const IMPROVEMENT_PROMPT = `Você é um consultor de melhoria de processos. A partir da transcrição de uma reunião, identifique o processo de trabalho que foi descrito, desenhe-o como ele é hoje e proponha uma versão melhorada. Escreva em português do Brasil. Não invente etapas, ferramentas, números ou ganhos que a conversa não sustente: quando estimar um ganho, deixe claro que é uma estimativa.

Responda SOMENTE com um JSON neste formato:
{
  "hasProcess": boolean,
  "reason": string | null,
  "overview": string | null,
  "current": { "steps": Step[], "links": Link[] } | null,
  "proposed": { "steps": Step[], "links": Link[] } | null,
  "changes": Change[]
}

Step = { "id": string curto e único (ex.: "a1"), "label": string de até 8 palavras, "type": "start" | "step" | "decision" | "end", "status": "normal" | "problem" | "new" | "automated" | "changed" }
Link = { "from": id, "to": id, "label": string | null }
Change = { "title": string, "why": string (o problema que isso resolve), "gain": string (ganho esperado, em uma frase), "effort": "baixo" | "medio" | "alto" }

Regras:
- Se a reunião não descreve nenhum processo que dê para desenhar, responda hasProcess=false, explique em "reason", e use current=null, proposed=null, changes=[].
- "overview": uma ou duas frases com o principal ganho da proposta.
- Cada diagrama tem de 4 a 10 passos, começa em um "start" e termina em um "end". Toda "decision" tem ligações rotuladas (ex.: "Sim" / "Não").
- No processo ATUAL use status "problem" nos passos que são gargalo, retrabalho ou manuais demais; os demais são "normal".
- No processo SUGERIDO use "new" para passo criado, "automated" para passo automatizado, "changed" para passo alterado e "normal" para o que fica igual. Passos removidos simplesmente não aparecem.
- "changes": uma entrada para cada mudança relevante entre o atual e o sugerido, da de maior impacto para a de menor.`;

export async function suggestProcessImprovement(input: {
  title: string;
  participants: string[];
  notes: string | null;
  transcript: string;
}): Promise<unknown> {
  const key = apiKey();

  const context = [
    `Título da reunião: ${input.title}`,
    input.participants.length > 0 ? `Participantes: ${input.participants.join(", ")}` : null,
    input.notes ? `Anotações feitas pelo usuário:\n${input.notes}` : null,
    `Transcrição:\n${input.transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_SUMMARY_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: IMPROVEMENT_PROMPT },
        { role: "user", content: context },
      ],
    }),
  });
  if (!response.ok) throw await failure(response);

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new AiError("A OpenAI não devolveu a sugestão. Tente de novo.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError("A resposta da OpenAI veio num formato inválido. Tente de novo.");
  }
}

import { z } from "zod";

/**
 * O diagnóstico de gargalos. Cada problema traz o trecho da conversa que o
 * sustenta, e o trecho só fica se de fato aparece na transcrição: a IA às vezes
 * "cita" frases que ninguém disse, e uma citação inventada num diagnóstico para
 * o cliente é pior do que nenhuma.
 */

const CATEGORIES = ["gargalo", "retrabalho", "manual", "risco"] as const;
const SEVERITIES = ["baixa", "media", "alta"] as const;

export type FindingCategory = (typeof CATEGORIES)[number];
export type FindingSeverity = (typeof SEVERITIES)[number];

const findingSchema = z.object({
  category: z.enum(CATEGORIES).catch("gargalo"),
  severity: z.enum(SEVERITIES).catch("media"),
  title: z.string().trim().min(1),
  description: z.string().nullish(),
  quote: z.string().nullish(),
});

const aiResultSchema = z.object({
  hasFindings: z.boolean().default(true),
  reason: z.string().nullish(),
  findings: z.array(z.unknown()).default([]),
});

/** O que fica salvo: igual ao que a IA devolve, mas com a citação já conferida. */
const storedFindingSchema = z.object({
  category: z.enum(CATEGORIES).catch("gargalo"),
  severity: z.enum(SEVERITIES).catch("media"),
  title: z.string().min(1),
  description: z.string().nullable().catch(null),
  /** Trecho literal da transcrição, ou `null` quando a IA não trouxe um que confira. */
  quote: z.string().nullable().catch(null),
});

const storedSchema = z.object({
  hasFindings: z.boolean(),
  reason: z.string().nullable().catch(null),
  findings: z.array(z.unknown()).default([]),
});

export type Finding = z.infer<typeof storedFindingSchema>;

export interface Diagnosis {
  /** `false` quando a reunião não traz problema algum de processo. */
  hasFindings: boolean;
  reason: string | null;
  findings: Finding[];
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = { alta: 0, media: 1, baixa: 2 };

/** Minúsculas, sem acento nem pontuação, espaços colapsados — para comparar trechos. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Um trecho curto demais ("sim", "o cliente") confere em qualquer transcrição e não prova nada. */
const MIN_QUOTE_LENGTH = 12;

/** `true` se o trecho aparece, de fato, na transcrição. */
export function quoteAppears(quote: string, transcript: string): boolean {
  const needle = normalize(quote);
  return needle.length >= MIN_QUOTE_LENGTH && normalize(transcript).includes(needle);
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Valida a resposta da IA contra a transcrição: confere cada citação (a que não
 * aparece é descartada, o problema fica) e ordena do mais grave para o menos.
 * `null` se a resposta não tiver a forma esperada.
 */
export function parseAiDiagnosis(raw: unknown, transcript: string): Diagnosis | null {
  const parsed = aiResultSchema.safeParse(raw);
  if (!parsed.success) return null;

  // Item a item: um item torto da IA é descartado, e não leva a lista inteira junto.
  const findings = parsed.data.findings.flatMap((entry): Finding[] => {
    const finding = findingSchema.safeParse(entry);
    if (!finding.success) return [];
    const { quote, description, ...rest } = finding.data;
    return [
      {
        ...rest,
        description: description?.trim() || null,
        quote: quote && quoteAppears(quote, transcript) ? quote.trim() : null,
      },
    ];
  });

  return {
    hasFindings: parsed.data.hasFindings && findings.length > 0,
    reason: parsed.data.reason ?? null,
    findings: sortFindings(findings),
  };
}

/** Valida o que veio do banco. `null` se não tiver a forma esperada. */
export function parseDiagnosis(raw: unknown): Diagnosis | null {
  const parsed = storedSchema.safeParse(raw);
  if (!parsed.success) return null;

  const findings = parsed.data.findings.flatMap((entry) => {
    const finding = storedFindingSchema.safeParse(entry);
    return finding.success ? [finding.data] : [];
  });

  return {
    hasFindings: parsed.data.hasFindings && findings.length > 0,
    reason: parsed.data.reason,
    findings: sortFindings(findings),
  };
}

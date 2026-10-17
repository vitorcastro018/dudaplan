import { z } from "zod";

/**
 * A sugestão de melhoria de processo. A IA devolve o processo como passos e
 * ligações (dados), e o Mermaid é montado aqui: assim um rótulo com aspas ou um
 * id como `end` nunca quebra o diagrama, e as cores seguem o tema do app.
 */

const STEP_TYPES = ["start", "step", "decision", "end"] as const;
const STEP_STATUSES = ["normal", "problem", "new", "automated", "changed"] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

const stepSchema = z.object({
  id: z.coerce.string().min(1),
  label: z.string().min(1),
  type: z.enum(STEP_TYPES).catch("step"),
  status: z.enum(STEP_STATUSES).catch("normal"),
});

const linkSchema = z.object({
  from: z.coerce.string(),
  to: z.coerce.string(),
  label: z.string().nullish(),
});

const flowSchema = z.object({
  steps: z.array(stepSchema),
  links: z.array(linkSchema),
});

const changeSchema = z.object({
  title: z.string().min(1),
  why: z.string().default(""),
  gain: z.string().default(""),
  effort: z.enum(["baixo", "medio", "alto"]).catch("medio"),
});

const improvementSchema = z.object({
  hasProcess: z.boolean(),
  reason: z.string().nullish(),
  overview: z.string().nullish(),
  current: flowSchema.nullish(),
  proposed: flowSchema.nullish(),
  changes: z.array(changeSchema).default([]),
});

export type ProcessFlow = z.infer<typeof flowSchema>;
export type ProcessChange = z.infer<typeof changeSchema>;

export interface ProcessImprovement {
  /** `false` quando a reunião não descreve um processo que dê para desenhar. */
  hasProcess: boolean;
  reason: string | null;
  overview: string | null;
  current: ProcessFlow | null;
  proposed: ProcessFlow | null;
  changes: ProcessChange[];
}

/** Descarta ligações que apontam para passos que não existem. */
function cleanFlow(flow: ProcessFlow | null | undefined): ProcessFlow | null {
  if (!flow || flow.steps.length < 2) return null;
  const ids = new Set(flow.steps.map((step) => step.id));
  return { steps: flow.steps, links: flow.links.filter((l) => ids.has(l.from) && ids.has(l.to)) };
}

/**
 * Valida o que veio da IA (ou do banco). Devolve `null` se não tiver a forma
 * esperada, em vez de deixar a tela quebrar com um JSON torto.
 */
export function parseImprovement(raw: unknown): ProcessImprovement | null {
  const parsed = improvementSchema.safeParse(raw);
  if (!parsed.success) return null;

  const current = cleanFlow(parsed.data.current);
  const proposed = cleanFlow(parsed.data.proposed);
  const hasProcess = parsed.data.hasProcess && current !== null && proposed !== null;

  return {
    hasProcess,
    reason: parsed.data.reason ?? null,
    overview: parsed.data.overview ?? null,
    current: hasProcess ? current : null,
    proposed: hasProcess ? proposed : null,
    changes: parsed.data.changes,
  };
}

/** Texto seguro para dentro de `["..."]` do Mermaid. */
function label(text: string): string {
  return text.replace(/[<>]/g, "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
}

/** Monta o `flowchart` do Mermaid. Os ids viram `n0`, `n1`... para nunca colidirem com palavras reservadas. */
export function toMermaid(flow: ProcessFlow): string {
  const index = new Map(flow.steps.map((step, i) => [step.id, `n${i}`]));
  const lines = ["flowchart TD"];

  flow.steps.forEach((step, i) => {
    const text = label(step.label);
    const id = `n${i}`;
    const shape =
      step.type === "decision"
        ? `${id}{"${text}"}`
        : step.type === "start" || step.type === "end"
          ? `${id}(["${text}"])`
          : `${id}["${text}"]`;
    lines.push(`  ${shape}:::${step.status}`);
  });

  for (const link of flow.links) {
    const text = link.label ? label(link.label) : "";
    const arrow = text ? `-->|"${text}"|` : "-->";
    lines.push(`  ${index.get(link.from)} ${arrow} ${index.get(link.to)}`);
  }

  return lines.join("\n");
}

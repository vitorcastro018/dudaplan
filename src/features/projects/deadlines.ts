import type { ProjectRow } from "@/lib/supabase/types";

/**
 * Os três prazos, na ordem em que aparecem no formulário e nas telas.
 *
 * Um módulo só, sem "use client", porque o formulário (cliente) e as telas de
 * leitura (servidor) precisam dos mesmos rótulos. Duplicar os textos deixaria o
 * nome do prazo mudar num lugar e não no outro.
 */
export const PROJECT_DEADLINES = [
  {
    column: "deadline_optimistic",
    field: "deadlineOptimistic",
    label: "Prazo otimista",
    hint: "Tudo flui, nada trava, ninguém falta.",
    tone: "pine",
  },
  {
    column: "deadline_mediocre",
    field: "deadlineMediocre",
    label: "Prazo medíocre",
    hint: "O cenário ruim que, ainda assim, entrega.",
    tone: "ochre",
  },
  {
    column: "deadline_realistic",
    field: "deadlineRealistic",
    label: "Prazo realista",
    hint: "A aposta honesta — a que orienta a priorização.",
    tone: "accent",
  },
] as const satisfies readonly {
  column: keyof ProjectRow;
  field: string;
  label: string;
  hint: string;
  tone: "pine" | "ochre" | "accent";
}[];

export type ProjectDeadline = (typeof PROJECT_DEADLINES)[number];

/**
 * Data a partir da qual a duração de cada prazo é contada.
 *
 * `start_date` quando existe; senão o dia em que o projeto foi criado. A
 * alternativa — contar sempre a partir de hoje — faria o número mudar sozinho a
 * cada dia que passa, e "o projeto dura 40 dias" viraria 39, 38, 37 sem nada ter
 * acontecido. Ancorar no início mantém a duração sendo uma propriedade do
 * projeto, não da data em que você abriu a tela.
 */
export function projectBaseline(project: {
  start_date: string | null;
  created_at: string;
}): string {
  return project.start_date ?? project.created_at.slice(0, 10);
}

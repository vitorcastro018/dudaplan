import { z } from "zod";
import { isValidDateKey } from "@/lib/date";

/**
 * Os próximos passos de uma reunião, prontos para virar tarefas. O responsável
 * que a IA identifica entra no título ("Enviar proposta (Maria)"): a tarefa não
 * tem campo de responsável, e assim a informação não se perde.
 */

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type ActionItemPriority = (typeof PRIORITIES)[number];

/** Só aceita data real no formato AAAA-MM-DD; qualquer outra coisa vira "sem prazo". */
const dueDate = z
  .string()
  .nullish()
  .transform((value) => (value && isValidDateKey(value) ? value : null));

/** O que a IA devolve. */
const aiItemSchema = z.object({
  title: z.string().trim().min(1),
  owner: z.string().nullish(),
  dueDate,
  priority: z.enum(PRIORITIES).catch("medium"),
});

const aiResultSchema = z.object({ items: z.array(z.unknown()).default([]) });

/** O que fica salvo na reunião. */
const itemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  dueDate,
  priority: z.enum(PRIORITIES).catch("medium"),
  /** Tarefa criada a partir deste item; `null` enquanto ainda não virou tarefa. */
  taskId: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
});

export type ActionItem = z.infer<typeof itemSchema>;

export type NewActionItem = Omit<ActionItem, "id" | "taskId">;

/** Valida a resposta da IA e junta o responsável ao título. `null` se não tiver a forma esperada. */
export function parseAiActionItems(raw: unknown): NewActionItem[] | null {
  const parsed = aiResultSchema.safeParse(raw);
  if (!parsed.success) return null;

  // Item a item: um item torto da IA é descartado, e não leva a lista inteira junto.
  const items = parsed.data.items.flatMap((entry) => {
    const item = aiItemSchema.safeParse(entry);
    return item.success ? [item.data] : [];
  });

  return items.map((item) => {
    const owner = item.owner?.trim();
    const title = owner && !item.title.includes(owner) ? `${item.title} (${owner})` : item.title;
    return { title: title.slice(0, 300), dueDate: item.dueDate, priority: item.priority };
  });
}

/** Valida o que veio do banco. Item torto é descartado, em vez de derrubar a tela. */
export function parseActionItems(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = itemSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

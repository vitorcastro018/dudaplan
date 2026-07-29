import { z } from "zod";

const titleField = z.string().trim().min(1, "Dê um título à reunião.").max(300);
const notesField = z.string().trim().max(20000).nullable().optional();
const projectIdField = z.string().uuid("Projeto inválido.").nullable().optional();

/** "AAAA-MM-DDTHH:MM", como o `<input type="datetime-local">` devolve. O
 *  segundo e o fuso ficam de fora: o campo não os produz, e a conversão para
 *  UTC acontece na action, com `localDateTimeToUtcIso`. */
const scheduledAtField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Data/hora inválida.")
  .nullable()
  .optional();

/**
 * Participantes, um por linha no `<textarea>`.
 *
 * Aceita uma string crua e devolve a lista já limpa, para que a action não
 * precise repetir o `split`/`trim`/deduplicação. O limite de 100 não é
 * arbitrário: é o suficiente para qualquer reunião real e evita que um texto
 * colado por engano vire cem `insert` numa tabela.
 */
const participantsField = z
  .string()
  .max(5000)
  .nullable()
  .optional()
  .transform((value) => {
    if (!value) return [];
    const names = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(0, 200));
    // Nome repetido viraria duas linhas idênticas em `meeting_participants`, e
    // a contagem na lista passaria a mentir.
    return [...new Set(names)];
  })
  .refine((names) => names.length <= 100, "No máximo 100 participantes.");

export const createMeetingSchema = z.object({
  title: titleField,
  scheduledAt: scheduledAtField,
  projectId: projectIdField,
  notes: notesField,
  participants: participantsField,
});

// Do zero, e não `.partial()`, pela mesma razão de sempre — ver o comentário em
// `src/lib/validation/tasks.ts`. Aqui não há `.default()`, mas manter os dois
// separados evita que acrescentar um no futuro reintroduza a armadilha em
// silêncio.
export const updateMeetingSchema = z.object({
  title: titleField.optional(),
  scheduledAt: scheduledAtField,
  projectId: projectIdField,
  notes: notesField,
  participants: participantsField,
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

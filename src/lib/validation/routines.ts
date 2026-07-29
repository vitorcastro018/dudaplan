import { z } from "zod";

export const routineCadenceSchema = z.enum(["daily", "weekdays", "weekly", "custom"]);
export const routineShiftSchema = z.enum(["morning", "afternoon", "night"]);

const nameField = z.string().trim().min(1, "Dê um nome à rotina.").max(200);
const descriptionField = z.string().trim().max(500).nullable().optional();
const shiftField = routineShiftSchema.nullable().optional();

/** Dias da semana em que a rotina vale — 0 = domingo, como em `active_days`. */
const activeDaysField = z.array(z.number().int().min(0).max(6)).nullable().optional();

/**
 * Link da rotina, com o esquema validado explicitamente.
 *
 * O valor vai parar num `<a href>`, e sem esta checagem um `javascript:alert(1)`
 * colado no campo viraria XSS ao primeiro clique. `new URL()` sozinho aceita
 * `javascript:` de bom grado — ele valida a *sintaxe*, não a segurança —, então
 * a lista de esquemas permitidos é o que faz o trabalho.
 *
 * Quem digita "notion.so/pauta" quer um link; completar com `https://` é mais
 * útil que recusar por falta de esquema.
 */
export const routineLinkField = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((value) => {
    if (!value) return null;
    return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  })
  .refine((value) => {
    if (value === null) return true;
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "O link precisa ser um endereço http:// ou https://.");

// Um refinamento só, aplicado aos dois schemas: cadência personalizada sem dia
// nenhum marcado esconderia a rotina de todos os dias — `getRoutineBoard` trata
// lista vazia como "todo dia", mas a intenção de quem escolheu "personalizada"
// e não marcou nada é ambígua o bastante para valer uma recusa explícita.
const customNeedsDays = (data: {
  cadence?: "daily" | "weekdays" | "weekly" | "custom";
  activeDays?: number[] | null;
}) => data.cadence !== "custom" || (data.activeDays?.length ?? 0) > 0;

const CUSTOM_DAYS_MESSAGE = {
  error: "Escolha pelo menos um dia da semana.",
  path: ["activeDays"],
};

export const createRoutineSchema = z
  .object({
    name: nameField,
    description: descriptionField,
    cadence: routineCadenceSchema.default("daily"),
    activeDays: activeDaysField,
    shift: shiftField,
    link: routineLinkField,
  })
  .refine(customNeedsDays, CUSTOM_DAYS_MESSAGE);

// Reconstruído do zero, e não `createRoutineSchema.partial()`: o `.partial()`
// preserva os `.default()`, então um update que não mencionasse `cadence`
// receberia "daily" e sobrescreveria em silêncio o valor gravado. Mesma
// armadilha comentada em `src/lib/validation/tasks.ts`.
export const updateRoutineSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
    cadence: routineCadenceSchema.optional(),
    activeDays: activeDaysField,
    shift: shiftField,
    link: routineLinkField,
  })
  .refine(customNeedsDays, CUSTOM_DAYS_MESSAGE);

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;

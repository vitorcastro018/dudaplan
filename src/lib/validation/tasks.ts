import { z } from "zod";
import { isValidDateKey } from "@/lib/date";

const dateKey = z
  .string()
  .refine(isValidDateKey, "Data inválida (esperado AAAA-MM-DD).")
  .nullable()
  .optional();

export const taskStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "waiting",
  "done",
  "cancelled",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const taskEnergySchema = z.enum(["low", "medium", "high"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à tarefa.").max(300),
  projectId: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  energy: taskEnergySchema.nullable().optional(),
  scheduledDate: dateKey,
  dueDate: dateKey,
  estimateMinutes: z.coerce.number().int().positive().nullable().optional(),
  blockedReason: z.string().trim().max(500).nullable().optional(),
});

// Reconstruído do zero, e não `createTaskSchema.partial()`: o `.partial()`
// preserva os `.default()`, então um update que não menciona `priority`
// receberia "medium" e sobrescreveria em silêncio o valor que já estava lá.
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  energy: taskEnergySchema.nullable().optional(),
  scheduledDate: dateKey,
  dueDate: dateKey,
  estimateMinutes: z.coerce.number().int().positive().nullable().optional(),
  blockedReason: z.string().trim().max(500).nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

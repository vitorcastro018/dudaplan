import { z } from "zod";

export const taskStatusSchema = z.enum(["TODO", "DOING", "BLOCKED", "DONE"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

const titleField = z.string().trim().min(1).max(200);
const descriptionField = z.string().trim().max(4000).optional().nullable();
const dueDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

export const createTaskSchema = z.object({
  title: titleField,
  description: descriptionField,
  status: taskStatusSchema.default("TODO"),
  priority: taskPrioritySchema.default("MEDIUM"),
  dueDate: dueDateField,
});

// Built independently from createTaskSchema: see note in validation/daily-checks.ts
// about why .partial() on a schema with .default() fields is unsafe for PATCH.
export const updateTaskSchema = z.object({
  title: titleField.optional(),
  description: descriptionField,
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: dueDateField,
});

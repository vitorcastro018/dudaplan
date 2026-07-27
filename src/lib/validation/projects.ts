import { z } from "zod";

export const projectStatusSchema = z.enum(["ACTIVE", "PAUSED", "DONE", "ARCHIVED"]);
const colorTokenSchema = z.enum(["accent", "pine", "ochre", "plum"]);

const nameField = z.string().trim().min(1).max(120);
const descriptionField = z.string().trim().max(4000).optional().nullable();
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

export const createProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
  colorToken: colorTokenSchema.default("accent"),
  startDate: dateField,
  dueDate: dateField,
});

// Built independently from createProjectSchema: see note in validation/daily-checks.ts
// about why .partial() on a schema with .default() fields is unsafe for PATCH.
export const updateProjectSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  colorToken: colorTokenSchema.optional(),
  startDate: dateField,
  dueDate: dateField,
  status: projectStatusSchema.optional(),
});

import { z } from "zod";

export const projectStatusSchema = z.enum(["ACTIVE", "PAUSED", "DONE", "ARCHIVED"]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  colorToken: z.enum(["accent", "pine", "ochre", "plum"]).default("accent"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: projectStatusSchema.optional(),
});

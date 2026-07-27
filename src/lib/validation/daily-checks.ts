import { z } from "zod";

export const colorTokenSchema = z.enum(["accent", "pine", "ochre", "plum"]);

export const createDailyCheckSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  emoji: z.string().trim().max(8).optional().nullable(),
  colorToken: colorTokenSchema.default("accent"),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
});

export const updateDailyCheckSchema = createDailyCheckSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const toggleDailyCheckSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
});

import { z } from "zod";

export const colorTokenSchema = z.enum(["accent", "pine", "ochre", "plum"]);

const titleField = z.string().trim().min(1).max(120);
const descriptionField = z.string().trim().max(2000).optional().nullable();
const emojiField = z.string().trim().max(8).optional().nullable();
const weekdaysField = z.array(z.number().int().min(0).max(6)).min(1).max(7);

export const createDailyCheckSchema = z.object({
  title: titleField,
  description: descriptionField,
  emoji: emojiField,
  colorToken: colorTokenSchema.default("accent"),
  weekdays: weekdaysField.default([0, 1, 2, 3, 4, 5, 6]),
});

// Built independently from createDailyCheckSchema: .partial() on a schema with
// .default() fields re-applies those defaults to omitted keys instead of leaving
// them untouched, which would silently reset colorToken/weekdays on a partial PATCH.
export const updateDailyCheckSchema = z.object({
  title: titleField.optional(),
  description: descriptionField,
  emoji: emojiField,
  colorToken: colorTokenSchema.optional(),
  weekdays: weekdaysField.optional(),
  isArchived: z.boolean().optional(),
});

export const toggleDailyCheckSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
});

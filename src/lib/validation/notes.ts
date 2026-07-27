import { z } from "zod";

const titleField = z.string().trim().max(200).optional().nullable();
const contentField = z.string().trim().min(1);

export const createNoteSchema = z.object({
  title: titleField,
  content: contentField,
  isPinned: z.boolean().default(false),
});

// Built independently from createNoteSchema: see note in validation/daily-checks.ts
// about why .partial() on a schema with .default() fields is unsafe for PATCH.
export const updateNoteSchema = z.object({
  title: titleField,
  content: contentField.optional(),
  isPinned: z.boolean().optional(),
});

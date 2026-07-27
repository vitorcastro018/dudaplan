import { z } from "zod";

const titleField = z.string().trim().min(1).max(200);
const contextNotesField = z.string().trim().max(4000).optional().nullable();
const participantsField = z.array(z.string().trim().min(1).max(120)).max(50);
const meetingDateField = z.string().datetime().optional();

export const createMeetingSchema = z.object({
  title: titleField,
  meetingDate: meetingDateField,
  participants: participantsField.default([]),
  contextNotes: contextNotesField,
});

export const updateMeetingSchema = z.object({
  title: titleField.optional(),
  meetingDate: meetingDateField,
  participants: participantsField.optional(),
  contextNotes: contextNotesField,
});

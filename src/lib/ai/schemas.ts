import { z } from "zod";

// OpenAI structured outputs (strict mode) require every property to be present
// in the response — optional fields must be modeled as nullable, not `.optional()`,
// or the API rejects the schema.

export const meetingAnalysisSchema = z.object({
  suggestedTitle: z.string(),
  summaryMarkdown: z.string(),
  decisions: z.array(
    z.object({
      description: z.string(),
      owner: z.string().nullable(),
    }),
  ),
  problems: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      severity: z.enum(["baixa", "media", "alta"]),
      evidence: z.string().nullable(),
    }),
  ),
  actionPlan: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      owner: z.string().nullable(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
      dueHint: z.string().nullable(),
    }),
  ),
  risks: z.array(
    z.object({
      description: z.string(),
      mitigation: z.string(),
    }),
  ),
  openQuestions: z.array(z.string()),
});

export type MeetingAnalysis = z.infer<typeof meetingAnalysisSchema>;

export const flowchartResponseSchema = z.object({
  title: z.string(),
  mermaid: z.string(),
});

export type FlowchartResponse = z.infer<typeof flowchartResponseSchema>;

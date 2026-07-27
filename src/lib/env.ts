import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  APP_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-transcribe"),
  OPENAI_ANALYSIS_MODEL: z.string().default("gpt-4o-mini"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(200),
});

export const env = envSchema.parse(process.env);

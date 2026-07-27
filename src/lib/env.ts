import { z } from "zod";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

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

// `next build` imports every route module to collect page data, which
// evaluates this file even though no request is ever handled — so it must
// not throw just because secrets aren't present yet. Docker builds only have
// build-time args (not the real runtime secrets), so during
// PHASE_PRODUCTION_BUILD we fill in placeholders for whatever is missing;
// any real values already set (e.g. from a build-arg) still win. Every other
// phase (dev, `next start`, the actual server) validates for real.
const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

const buildPlaceholders = {
  DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  APP_PASSWORD: "placeholder",
  SESSION_SECRET: "placeholder-secret-placeholder-secret",
  OPENAI_API_KEY: "sk-placeholder",
};

// A platform that forwards `--build-arg VAR` for a variable with no build-time
// value hands the build an empty string rather than leaving it unset (Coolify
// does this for every variable not explicitly marked as a build variable). An
// empty string would override the placeholders above and fail validation, so
// drop empties before merging. Only build phase gets this treatment: at runtime
// an empty required variable must still be a hard error, never a placeholder.
function withoutEmptyValues(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
}

export const env = envSchema.parse(
  isBuildPhase ? { ...buildPlaceholders, ...withoutEmptyValues(process.env) } : process.env,
);

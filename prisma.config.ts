import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` (run during the Docker build, before runtime env vars
// exist) doesn't connect to a database — it only reads the schema. The
// strict `env()` helper throws if DATABASE_URL is unset, which breaks that
// build step, so fall back to a placeholder there. `migrate deploy` (run at
// container startup, with real env vars injected) always has the real value.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});

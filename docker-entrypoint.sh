#!/bin/sh
set -e

# Fail loudly and specifically when configuration is missing. Without this the
# Prisma config falls back to a placeholder DATABASE_URL (needed so `prisma
# generate` can run at build time, where no secrets exist) and the container
# ends up in a restart loop reporting a confusing "can't reach localhost:5432"
# instead of the real problem, which is an unset variable.
missing=""
for var in DATABASE_URL APP_PASSWORD SESSION_SECRET OPENAI_API_KEY; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    missing="$missing $var"
  fi
done

if [ -n "$missing" ]; then
  echo "ERROR: missing required environment variable(s):$missing" >&2
  echo "Set them in your deployment's environment settings (see .env.example)." >&2
  exit 1
fi

echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

exec "$@"

# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# The `prisma` CLI is needed at container startup for `migrate deploy`, but
# Next's standalone output only traces what the *server* imports, so the CLI
# isn't in it. Installing it on its own here — rather than shipping the whole
# production dependency tree just to get it — keeps the runtime image small.
# A standalone install also gets a complete, self-consistent dependency tree,
# which hand-picking individual packages did not (that broke as soon as one of
# prisma's transitive deps changed). Versions come from package-lock.json, not
# the semver ranges in package.json, so the CLI is always the exact same
# version as the @prisma/client the app was built against.
FROM node:22-bookworm-slim AS prisma-cli
WORKDIR /opt/prisma-cli
COPY package-lock.json /tmp/app-package-lock.json
RUN npm init -y > /dev/null \
    && npm install --omit=dev \
    "prisma@$(node -p "require('/tmp/app-package-lock.json').packages['node_modules/prisma'].version")" \
    "dotenv@$(node -p "require('/tmp/app-package-lock.json').packages['node_modules/dotenv'].version")"

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=6555 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/data/uploads

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 nodejs \
    && useradd -u 1001 -g nodejs -m nextjs

# The CLI tree goes down first so that standalone's traced modules overwrite
# any overlap: the server's own dependency versions must always win, since the
# CLI only runs once at startup and the server runs for the life of the
# container. Together these are ~300MB, against ~1.2GB for a full production
# install of every dependency (most of which — mermaid, lucide-react, date-fns
# — only ever run in the browser and are already bundled into .next).
COPY --from=prisma-cli /opt/prisma-cli/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Bake the Prisma schema engine binary into the image. If it's missing (or
# unusable) when `migrate deploy` runs at startup, the CLI tries to download it
# into node_modules — which fails as the non-root app user with "Can't write to
# /app/node_modules/@prisma/engines" and leaves the container restart-looping.
# Running `prisma version` here resolves and fetches it while we still have root
# and build-time network. The chown covers the engine being refreshed later.
RUN node node_modules/prisma/build/index.js version > /dev/null \
    && chown -R nextjs:nodejs /app/node_modules/@prisma/engines

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/data/uploads \
    && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 6555
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]

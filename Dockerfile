# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# Production runner. Next's standalone output only traces node_modules for
# code that's actually imported by the server at runtime, so it doesn't
# include the `prisma` CLI (needed for `migrate deploy`) or its own fairly
# heavy dependency tree. Rather than hand-picking which extra packages the
# CLI needs — which broke in testing as soon as one of prisma's transitive
# deps changed — this stage replaces standalone's pruned node_modules with a
# plain `npm ci --omit=dev` install, which is verified to work for both the
# CLI and the server. That trades some image size for reliability.
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

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Replace standalone's pruned node_modules with the full production install
# (see note above the runner stage).
RUN rm -rf ./node_modules
COPY --from=deps-prod /app/node_modules ./node_modules

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

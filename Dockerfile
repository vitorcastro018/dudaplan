# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=6555 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/data/uploads

# ffmpeg é para o pipeline de reuniões, que fatia áudio acima do limite de 25MB
# da OpenAI. Por isso a base é bookworm-slim e não Alpine: o ffmpeg do apt é o
# de verdade. Continua aqui porque a fatia 2 volta a usá-lo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 nodejs \
    && useradd -u 1001 -g nodejs -m nextjs

# Só a saída standalone: o Next traça sozinho os módulos que o servidor
# realmente importa. Sem Prisma, some junto o estágio que instalava a CLI, o
# schema copiado para o runtime e o passo que baixava a engine — que era a
# origem do loop de restart com "Can't write to /app/node_modules/@prisma/engines".
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/data/uploads \
    && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 6555
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]

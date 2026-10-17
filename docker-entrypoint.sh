#!/bin/sh
set -e

# Falha alto e específico quando falta configuração. Sem isto o app sobe, a
# validação de env estoura no primeiro request e o container entra em loop de
# restart reportando um erro de Zod no meio de um stack trace de render — em vez
# de dizer, na primeira linha do log, qual variável está faltando.
if [ -z "$DATABASE_URL" ] && { [ -z "$PGHOST" ] || [ -z "$PGPASSWORD" ]; }; then
  echo "ERRO: falta configurar a conexão com o Postgres." >&2
  echo "" >&2
  echo "Defina DATABASE_URL (postgres://usuario:senha@host:5432/banco) ou então" >&2
  echo "PGHOST, PGUSER, PGPASSWORD e PGDATABASE. Com o docker-compose deste" >&2
  echo "repositório elas são montadas a partir de SERVICE_PASSWORD_POSTGRES, que o" >&2
  echo "Coolify gera sozinho no primeiro deploy — se aparece este erro, essa" >&2
  echo "variável está vazia (fora do Coolify, defina-a no .env)." >&2
  exit 1
fi

# Aplica as migrations pendentes antes de subir o servidor. É idempotente (só
# roda o que ainda não foi aplicado) e usa uma trava no banco, então dois
# containers subindo juntos num redeploy não disputam a mesma migration. Se
# falhar, o container não sobe: melhor parar aqui do que servir um app contra um
# schema pela metade.
node /app/db/migrate.mjs

exec "$@"

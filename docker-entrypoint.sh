#!/bin/sh
set -e

# Falha alto e específico quando falta configuração. Sem isto o app sobe, a
# validação de env estoura no primeiro request e o container entra em loop de
# restart reportando um erro de Zod no meio de um stack trace de render — em vez
# de dizer, na primeira linha do log, qual variável está faltando.
if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: falta a variável de ambiente DATABASE_URL." >&2
  echo "" >&2
  echo "Formato: postgres://usuario:senha@host:5432/banco" >&2
  echo "Com o docker-compose deste repositório ela é montada sozinha a partir de" >&2
  echo "POSTGRES_PASSWORD — defina essa no ambiente do deploy (no Coolify:" >&2
  echo "Environment Variables)." >&2
  exit 1
fi

# Aplica as migrations pendentes antes de subir o servidor. É idempotente (só
# roda o que ainda não foi aplicado) e usa uma trava no banco, então dois
# containers subindo juntos num redeploy não disputam a mesma migration. Se
# falhar, o container não sobe: melhor parar aqui do que servir um app contra um
# schema pela metade.
node /app/db/migrate.mjs

exec "$@"

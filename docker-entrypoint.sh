#!/bin/sh
set -e

# Falha alto e específico quando falta configuração. Sem isto o app sobe, a
# validação de env estoura no primeiro request e o container entra em loop de
# restart reportando um erro de Zod no meio de um stack trace de render — em vez
# de dizer, na primeira linha do log, qual variável está faltando.
#
# Não há mais migration para rodar aqui: o schema vive no Supabase e é aplicado
# por fora, com `supabase db push` ou pelo SQL Editor. Um redeploy do app não
# mexe mais no banco, que era de onde vinha boa parte do risco de subir.
missing=""
for var in SUPABASE_URL OPENAI_API_KEY; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    missing="$missing $var"
  fi
done

if [ -z "$SUPABASE_PUBLISHABLE_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
  missing="$missing SUPABASE_PUBLISHABLE_KEY"
fi

if [ -n "$missing" ]; then
  echo "ERRO: falta(m) variável(is) de ambiente:$missing" >&2
  echo "Configure no ambiente do deploy (veja .env.example)." >&2
  exit 1
fi

exec "$@"

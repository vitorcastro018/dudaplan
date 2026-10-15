#!/bin/sh
# Cria um banco descartável, aplica as migrations e roda os testes de schema.
#
#   DATABASE_URL=postgres://usuario:senha@localhost:5432/postgres bash db/tests/run.sh
#
# A URL só precisa apontar para um servidor onde o usuário possa criar bancos; o
# teste usa um banco próprio (`dudaplan_test`) e o apaga no fim.
set -e

: "${DATABASE_URL:?defina DATABASE_URL apontando para um servidor Postgres}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADMIN_URL="$DATABASE_URL"
TEST_URL="$(echo "$DATABASE_URL" | sed -E 's#/[^/?]*(\?.*)?$#/dudaplan_test\1#')"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists dudaplan_test" -c "create database dudaplan_test"
trap 'psql "$ADMIN_URL" -q -c "drop database if exists dudaplan_test" >/dev/null' EXIT

DATABASE_URL="$TEST_URL" node "$ROOT/db/migrate.mjs"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/db/tests/schema.test.sql"

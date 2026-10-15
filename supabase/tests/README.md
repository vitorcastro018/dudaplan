# Testes de RLS e invariantes

Rodam contra um Postgres local, sem precisar de projeto Supabase. `00_auth_stub.sql`
recria o mínimo que o Supabase fornece (schema `auth`, `auth.users` com
`raw_user_meta_data`, `auth.uid()` e os papéis `anon`/`authenticated`), com uma
diferença: aqui `auth.uid()` lê o GUC `test.uid` em vez da claim `sub` do JWT,
para dar como trocar de identidade no meio do teste.

## Por que os testes rodam com `set role authenticated`

Dono de tabela ignora RLS — o Postgres só aplica as políticas a quem não é dono
(a menos que se use `force row level security`). Rodando os testes como o dono do
schema, **toda** verificação de "fulano não consegue ver isso" passaria sem que
uma única política existisse. Por isso todo caso roda como `authenticated`, que é
o papel real do usuário logado via Data API.

Pelo mesmo motivo cada arquivo mistura casos negativos e positivos: se só
houvesse negativos, um erro que bloqueasse tudo (ou um SELECT que não retorna
nada por engano) pareceria sucesso.

## Como rodar

```bash
createdb dudaplan_rls
psql -d dudaplan_rls -f supabase/tests/00_auth_stub.sql
for f in supabase/migrations/*.sql; do psql -d dudaplan_rls -v ON_ERROR_STOP=1 -f "$f"; done

psql -d dudaplan_rls -f supabase/tests/01_isolamento.sql
psql -d dudaplan_rls -f supabase/tests/02_tabelas_filhas.sql
psql -d dudaplan_rls -f supabase/tests/03_invariantes.sql
```

Os arquivos rodam com `ON_ERROR_STOP off` de propósito: boa parte do que se
espera **é** um erro (`new row violates row-level security policy`), e parar no
primeiro encerraria a suíte no primeiro acerto. A conferência é feita lendo a
saída — cada bloco diz no `\echo` o que deve acontecer.

## O que cada arquivo cobre

| Arquivo | Cobertura |
|---|---|
| `01_isolamento.sql` | cadastro via trigger, leitura cruzada entre usuários, `WITH CHECK` no UPDATE (passar a linha para outro usuário), perfil próprio |
| `02_tabelas_filhas.sql` | tabelas que herdam a posse pelo pai (`meeting_participants`, `recordings`, `routine_logs`), inserção com ID estrangeiro explícito e `anon` sem GRANT nenhum |
| `03_invariantes.sql` | profundidade de subtarefa, `waiting` sem motivo, `done` sem `completed_at`, log de rotina duplicado, `completed` junto com `skipped` e projeto sem problema/resultado — tudo executado como `authenticated` |

## Limitação conhecida

Isto valida o comportamento **no Postgres**. Não valida Supabase Auth emitindo
JWT de verdade, Storage, nem a exposição pela Data API — para isso é preciso
`supabase start` (Docker) ou um projeto real.

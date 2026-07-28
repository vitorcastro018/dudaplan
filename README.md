# DudaPlan

Software pessoal de controle de projetos, tarefas e rotinas, construído sobre Supabase.

Estado atual: **fatia 1** — login real, a tela "Hoje", rotinas diárias e projetos com tarefas. As reuniões com IA (gravação, transcrição, ata, plano de ação e fluxograma) entram na fatia 2; o código delas está no histórico do Git, no commit `f55a305`.

## Stack

- Next.js 16 (App Router, TypeScript) full-stack — sem backend separado
- Supabase: Postgres, Auth e RLS
- Tailwind CSS 4, `next/font` (Fraunces, Archivo, JetBrains Mono)
- Docker / docker-compose, pronto para Coolify

Todo acesso a dados acontece em Server Component ou Server Action. O navegador nunca recebe a chave do Supabase, e a autorização é feita pelo RLS no banco — não por checagem na aplicação.

## Preparar o Supabase

1. Aplique as migrations, **na ordem**, pelo SQL Editor ou com `supabase db push`:

   | Arquivo | O que faz |
   | --- | --- |
   | `20260728000000_core_schema.sql` | as 25 tabelas e os invariantes que cabem em CHECK |
   | `20260728000001_business_invariants.sql` | os invariantes que dependem de outras linhas, via trigger |
   | `20260728000002_rls.sql` | RLS em todas as tabelas e privilégios da Data API |
   | `20260728000003_auth_bootstrap.sql` | cria perfil, workspace e associação no cadastro |

2. Em **Authentication > Providers > Email**, desligue a confirmação de e-mail. Sem isso o login depende de SMTP, e o servidor de e-mail padrão do Supabase só entrega para membros do projeto.

3. Crie seu usuário em **Authentication > Users > Add user**, com e-mail e senha.

4. Confirme que o bootstrap funcionou:

   ```sql
   select u.email, w.name, m.role
   from public.users u
   join public.memberships m on m.user_id = u.id
   join public.workspaces w on w.id = m.workspace_id;
   ```

   Precisa voltar uma linha com `role = 'owner'`. Se voltar vazio, o usuário foi criado antes da migration 4 — apague e recrie. **Sem a associação, o RLS esconde tudo e o app abre vazio.**

## Desenvolvimento local

```bash
npm install
cp .env.example .env   # preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Acesse `http://localhost:6555` e entre com o usuário criado no painel.

### Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento (Turbopack) |
| `npm run build` | build de produção |
| `npm run lint` / `npm run format` | lint e formatação |

## Deploy com Docker / Coolify

1. Preencha `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `OPENAI_API_KEY`.
2. `docker compose up -d --build`.
3. No Coolify, crie um recurso apontando para este repositório usando o `docker-compose.yml` e configure:
   - as variáveis de ambiente do `.env.example` — todas de **runtime**, nenhuma precisa ser build arg;
   - health check em `GET /api/health`;
   - domínio com TLS (necessário para a gravação de áudio da fatia 2, que exige HTTPS);
   - um volume persistente em `/app/data`, também para a fatia 2.

Não há mais serviço de banco no compose, nem migration rodando no start do container: o schema vive no Supabase e é aplicado por fora. Um redeploy do app não toca no banco.

> Use sempre a chave **publicável** (ou "anon"). A `service_role` ignora o RLS — com ela no app, qualquer usuário logado enxergaria os dados de todos.

### Backup

O banco fica no Supabase, que tem backup próprio no painel (Database > Backups). O volume `/app/data` guarda os áudios das reuniões:

```bash
docker run --rm -v dudaplan_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
```

## Testes do banco

`supabase/tests/` roda contra um Postgres local, sem precisar de projeto Supabase — cobre isolamento entre workspaces, as políticas de RLS e os invariantes de negócio. Veja `supabase/tests/README.md`, em especial por que os testes rodam como `authenticated` e não como dono do schema.

## Estrutura do projeto

```
src/
  app/            rotas (App Router)
  components/     UI base (design system) e layout (sidebar, shell)
  features/       componentes client por domínio (hoje, rotinas, projetos)
  lib/
    actions/      Server Actions (mutações)
    ai/           cliente OpenAI, prompts e schemas — usados na fatia 2
    data/         consultas usadas pelos Server Components
    supabase/     clientes (server, middleware) e tipos do banco
    validation/   schemas Zod de cada feature
supabase/
  migrations/     schema, invariantes, RLS e bootstrap de cadastro
  tests/          testes de RLS e invariantes contra Postgres local
```

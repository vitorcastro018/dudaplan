# DudaPlan

Software pessoal de controle de projetos, tarefas e rotinas, construído sobre Supabase.

Estado atual: **fatia 1** — login real, a tela "Hoje", rotinas diárias e projetos com tarefas. As reuniões com IA (gravação, transcrição, ata, plano de ação e fluxograma) entram na fatia 2; o código delas está no histórico do Git, no commit `f55a305`.

## Stack

- Next.js 16 (App Router, TypeScript) full-stack — sem backend separado
- Supabase: Postgres, Auth e RLS
- Tailwind CSS 4, `next/font` (Fraunces, Archivo, JetBrains Mono)
- Docker / docker-compose, pronto para Coolify

Todo acesso a dados acontece em Server Component ou Server Action. O navegador nunca recebe a chave do Supabase, e a autorização é feita pelo RLS no banco — não por checagem na aplicação.

## Supabase

O projeto **`dudaplan`** (`drhnfkfdnhxcqzyqbpgc`, região `sa-east-1`) já está criado e com o schema aplicado: 25 tabelas, RLS em todas elas, invariantes de negócio e o trigger de cadastro. As migrations em `supabase/migrations/` são o registro do que foi aplicado — rodá-las de novo num projeto novo reproduz o mesmo estado.

Se precisar recriar do zero, aplique na ordem:

| Arquivo | O que faz |
| --- | --- |
| `20260728000000_core_schema.sql` | as 25 tabelas e os invariantes que cabem em CHECK |
| `20260728000001_business_invariants.sql` | os invariantes que dependem de outras linhas, via trigger |
| `20260728000002_rls.sql` | RLS em todas as tabelas e privilégios da Data API |
| `20260728000003_auth_bootstrap.sql` | cria perfil, workspace e associação no cadastro |
| `20260728000004_security_advisor_fixes.sql` | correções apontadas pelos advisors |

### Falta só criar seu usuário

Em **Authentication > Users > Add user > Create new user**, com e-mail e senha, e **marque "Auto Confirm User"**. Marcando isso, o login não depende de SMTP — o servidor de e-mail padrão do Supabase só entrega para membros do projeto.

Depois confirme que o bootstrap rodou:

```sql
select u.email, w.name, m.role
from public.users u
join public.memberships m on m.user_id = u.id
join public.workspaces w on w.id = m.workspace_id;
```

Precisa voltar uma linha com `role = 'owner'`. Se voltar vazio, **o RLS esconde tudo e o app abre vazio** — apague o usuário e recrie.

### Onde achar URL e chave

| Variável | Onde está no painel do Supabase |
| --- | --- |
| `SUPABASE_URL` | Project Settings > Data API |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings > API Keys |

Use a chave **publicável** (nos projetos mais antigos ela aparece como "anon" — o app aceita as duas). **Nunca a `service_role`**: ela ignora o RLS e daria acesso total ao banco.

Nenhum valor fica gravado no repositório. Em produção eles vêm das variáveis de ambiente do Coolify; localmente, do `.env` (que o `.gitignore` cobre).

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

No Coolify, crie um recurso apontando para este repositório usando o `docker-compose.yml` e preencha, em **Environment Variables**, só estas duas:

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Todas as variáveis são de **runtime** — nenhuma precisa ser build arg, e trocar uma delas é reiniciar o container, não rebuildar. As demais têm padrão e podem ficar em branco; `OPENAI_API_KEY` só passa a ser necessária na fatia 2.

Se esquecer uma das duas, o `docker compose` para na hora dizendo qual falta, e o entrypoint repete a checagem antes de o servidor subir — em vez de o container subir e morrer depois com um erro de validação no meio de um stack trace.

Configure também:
- health check em `GET /api/health`;
- domínio com TLS (necessário para a gravação de áudio da fatia 2, que exige HTTPS);
- um volume persistente em `/app/data`, também para a fatia 2.

Para rodar local: `cp .env.example .env`, preencha as duas, e `docker compose up -d --build`.

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

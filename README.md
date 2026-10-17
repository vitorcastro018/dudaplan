# DudaPlan

Software pessoal, de uma pessoa só, para controle de projetos, tarefas, rotinas e reuniões.

Hoje tem: login próprio, a tela **Hoje**, rotinas com turno e link, projetos (com problema, resultado esperado e três prazos) e tarefas, tudo editável, e reuniões com anotações e gravação ou anexo de áudio. Na aba **Áudio** da reunião, o botão **Resumo com IA** transcreve o áudio e gera o resumo pela OpenAI; o resultado fica salvo na reunião. Precisa de `OPENAI_API_KEY` (áudio de até 25 MB). Ata e plano de ação ainda não existem.

## Stack

- **Next.js 16** (App Router, TypeScript), full-stack — sem backend separado
- **PostgreSQL 17**, rodando no mesmo `docker-compose` do app, na própria VPS
- Driver `pg` com SQL direto; sem ORM
- Tailwind CSS 4, `next/font` (Fraunces, Archivo, JetBrains Mono)
- Docker / docker-compose, pronto para o Coolify

Todo acesso a dados acontece em Server Component, Server Action ou Route Handler. O navegador nunca fala com o banco.

## Como funciona o acesso

- **Login próprio:** e-mail e senha (hash scrypt). A sessão é um token aleatório num cookie `httpOnly`; no banco fica só o hash dele (tabela `sessions`), então apagar a linha derruba o acesso na hora.
- **Isolamento:** toda linha de dado tem `user_id` e **toda consulta filtra por ele** (`src/lib/data/*` e `src/lib/actions/*`). Não há RLS — o banco não é exposto, e o único cliente dele é o servidor. Onde uma linha aponta para outra (tarefa → projeto), a chave estrangeira é composta com `user_id`, então o próprio banco recusa ligar dados de contas diferentes.
- **Cadastro:** aberto por padrão. No Coolify o código de convite é gerado sozinho (`SERVICE_PASSWORD_SIGNUP`); fora dele, defina `APP_SIGNUP_CODE` para exigir um.

## Rodando localmente

Precisa de Node 22 e de um Postgres.

```bash
docker run -d --name dudaplan-db -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=dudaplan -p 5432:5432 postgres:17-alpine

npm install
cp .env.example .env     # descomente DATABASE_URL=postgres://postgres:dev@localhost:5432/dudaplan
npm run db:migrate
npm run dev
```

Acesse `http://localhost:6555` e crie sua conta na aba **Criar conta**.

| Script                            | Descrição                                        |
| --------------------------------- | ------------------------------------------------ |
| `npm run dev`                     | servidor de desenvolvimento                      |
| `npm run build`                   | build de produção                                |
| `npm run lint` / `npm run format` | lint e formatação                                |
| `npm run db:migrate`              | aplica as migrations pendentes em `DATABASE_URL` |

## Deploy na VPS com Coolify

1. No Coolify, crie um recurso **Docker Compose** apontando para este repositório.
2. **Não precisa criar nenhuma variável.** O compose usa variáveis "mágicas" do Coolify, que ele gera sozinho no primeiro deploy e mostra em _Environment Variables_ (os valores persistem entre deploys):

   | Variável gerada                  | Para que serve                                                                                         |
   | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
   | `SERVICE_PASSWORD_POSTGRES`      | senha do banco. **Não a troque depois que o banco existir** — o Postgres só a usa na criação do volume |
   | `SERVICE_PASSWORD_SIGNUP`        | código de convite do cadastro. **É ele que você digita ao criar a conta**; pode trocar por uma frase   |
   | `SERVICE_PASSWORD_64_ACTIONSKEY` | semente da chave de criptografia das Server Actions (o container deriva a chave). Não precisa mexer    |

   O app conecta ao banco pelas variáveis `PG*`, então a senha pode ter qualquer caractere. Todas as variáveis são de **runtime**: trocar uma é reiniciar o container, não rebuildar.

3. Configure o domínio com TLS no serviço `app` (porta 6555) e o health check em `GET /api/health`. O navegador só libera o microfone em HTTPS ou `localhost`; sem TLS a reunião aceita só áudio anexado.
4. Faça o deploy. No start, o container do app **aplica as migrations pendentes** antes de subir o servidor; se uma falhar, ele não sobe.

O compose cria dois volumes que **precisam persistir**: `pgdata` (o banco) e `uploads` (`/app/data`, os áudios das reuniões). Apagar qualquer um apaga esses dados.

O Postgres não publica porta nenhuma: só o app o alcança, pela rede interna do compose.

### Atrás do proxy do Coolify

O proxy termina o TLS e fala HTTP com o container. Duas consequências, ambas já tratadas no código:

- **Redirect de login:** o `src/proxy.ts` monta a URL a partir dos cabeçalhos `X-Forwarded-*`, e o cookie de sessão fica `Secure` só quando a requisição chegou por HTTPS.
- **CSRF das Server Actions:** o Next compara `Origin` com `Host`/`X-Forwarded-Host`. O Traefik do Coolify normalmente repassa o cabeçalho e nada precisa ser feito. Se **nenhuma** mutação funcionar (login falha, criar tarefa não salva), preencha `APP_ALLOWED_ORIGINS` com o seu domínio.

### Upload de áudio

O áudio não passa por Server Action (limite de 1 MB), e sim por `POST /api/meetings/[meetingId]/audio`, que grava em streaming direto no volume. A rota fica **fora** do matcher de `src/proxy.ts` de propósito: com o proxy no caminho o Next bufferiza o corpo com teto de 10 MB e trunca em silêncio o que passar disso. A checagem de sessão é feita dentro da própria rota. `MAX_UPLOAD_MB` (padrão 200) limita o tamanho.

## Banco de dados

O schema vive em `db/migrations/*.sql`, aplicado em ordem por `db/migrate.mjs` (uma vez cada, numa transação, com trava contra execução simultânea). Para mudar o schema, **crie uma migration nova** (`0002_...sql`); nunca edite uma já aplicada.

Tabelas: `users`, `sessions`, `projects`, `tasks`, `routines`, `routine_logs`, `meetings`, `meeting_participants`, `recordings`.

Acessar o banco em produção:

```bash
docker compose exec db psql -U dudaplan -d dudaplan
```

`db/reset.sql` tem os comandos (comentados) para zerar dados ou apagar uma conta.

### Testes do schema

```bash
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres sh db/tests/run.sh
```

Cria um banco descartável, aplica as migrations e roda `db/tests/schema.test.sql`, que cobre as regras de negócio (tarefa `waiting` exige motivo, `done` exige data de conclusão, projeto exige problema e resultado, log de rotina único por dia), o isolamento entre contas e as cascatas. Cada caso lança exceção se falhar, então o comando termina com erro — é o que o CI usa.

### Backup

O banco **não tem backup automático**. Agende um `pg_dump` (no Coolify, uma tarefa agendada ou um cron da VPS):

```bash
docker compose exec -T db pg_dump -U dudaplan -d dudaplan -Fc > dudaplan-$(date +%F).dump
```

Restaurar:

```bash
docker compose exec -T db pg_restore -U dudaplan -d dudaplan --clean --if-exists < dudaplan-AAAA-MM-DD.dump
```

Os áudios ficam no volume `uploads`, que o `pg_dump` **não** cobre:

```bash
docker run --rm -v <projeto>_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
```

Guarde as duas cópias fora da VPS.

## Estrutura

```
src/
  app/            rotas (App Router)
  components/     UI base (design system) e layout (sidebar, shell)
  features/       componentes client por domínio (hoje, rotinas, projetos, tarefas, reuniões)
  lib/
    actions/      Server Actions (mutações)
    data/         consultas usadas pelos Server Components
    auth/         hash de senha
    validation/   schemas Zod de cada feature
    storage/      gravação do áudio das reuniões em disco
    db.ts         pool do Postgres e helpers de consulta
    session.ts    sessão por cookie (requireUser, createSession)
db/
  migrations/     schema, em SQL puro
  migrate.mjs     aplicador de migrations (roda no start do container)
  tests/          testes do schema
  reset.sql       comandos de reset
.github/workflows/ci.yml   lint, tipos, testes do schema e build a cada push/PR
```

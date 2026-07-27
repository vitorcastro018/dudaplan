# DudaPlan

Software pessoal de controle de projetos e tarefas, com Checks Diários e uma área de Projetos (notas, tarefas e reuniões). O diferencial é a IA: grave o áudio de uma reunião direto no navegador e o DudaPlan transcreve, gera a ata, identifica problemas, sugere um plano de ação e desenha um fluxograma de melhoria de processo.

## Stack

- Next.js 16 (App Router, TypeScript) full-stack — sem backend separado
- PostgreSQL via Prisma 7 (driver adapter `pg`)
- OpenAI (transcrição + `gpt-4o-mini` para ata/plano de ação/fluxograma)
- Tailwind CSS 4, `next/font` (Fraunces, Archivo, JetBrains Mono)
- Docker / docker-compose, pronto para Coolify

## Desenvolvimento local

Pré-requisitos: Node 22+, um PostgreSQL rodando localmente (ou via `docker compose up -d db`), `ffmpeg` instalado se quiser testar o corte de áudios longos.

```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL para localhost, defina as chaves
npm run db:migrate     # aplica as migrations (cria o banco na primeira vez)
npm run db:seed        # opcional: dados de exemplo
npm run dev
```

Acesse `http://localhost:6555`, a senha de acesso é a definida em `APP_PASSWORD`.

> A gravação de áudio (`getUserMedia`) só funciona em `localhost` ou HTTPS — em produção, o domínio precisa ter certificado TLS.

### Scripts úteis

| Script                            | Descrição                                        |
| --------------------------------- | ------------------------------------------------ |
| `npm run dev`                     | servidor de desenvolvimento (Turbopack)          |
| `npm run build`                   | build de produção (roda `prisma generate` antes) |
| `npm run db:migrate`              | cria/aplica migrations em desenvolvimento        |
| `npm run db:deploy`               | aplica migrations pendentes (usado em produção)  |
| `npm run db:seed`                 | popula dados de exemplo                          |
| `npm run db:studio`               | abre o Prisma Studio                             |
| `npm run lint` / `npm run format` | lint e formatação                                |

## Deploy com Docker / Coolify

1. Copie `.env.example` para `.env` e preencha `APP_PASSWORD`, `SESSION_SECRET` (`openssl rand -base64 32`), as credenciais do Postgres e `OPENAI_API_KEY`. Mantenha o host do banco como `db` (nome do serviço no `docker-compose.yml`).
2. Suba tudo com:
   ```bash
   docker compose up -d --build
   ```
   O container `app` aplica as migrations automaticamente antes de subir o servidor (via `docker-entrypoint.sh`).
3. No Coolify: crie um recurso apontando para este repositório usando `docker-compose.yml` (ou Dockerfile + um Postgres gerenciado pelo Coolify, ajustando `DATABASE_URL`). Configure:
   - Domínio com **TLS obrigatório** (gravação de áudio não funciona em HTTP puro);
   - As variáveis de ambiente do `.env.example`;
   - Um **volume persistente** apontando para `/app/data` — sem isso, os áudios das reuniões somem a cada redeploy;
   - Health check em `GET /api/health`.
4. O build baixa fontes do Google Fonts, então a etapa de build precisa de acesso à rede.

### Se aparecer "Authentication failed ... credentials for `dudaplan` are not valid"

O Postgres grava a senha **apenas na primeira inicialização**, enquanto o diretório de dados ainda está vazio. Depois disso, alterar `POSTGRES_PASSWORD` não muda nada no banco já criado — ele continua com a senha original, e o app passa a falhar na autenticação.

Se o volume foi criado com uma senha diferente da que está hoje no `DATABASE_URL`, há dois caminhos:

```bash
# Sem dados que valha a pena preservar: recria o volume do zero
docker compose down
docker volume ls | grep pgdata
docker volume rm <nome-do-volume-pgdata>
docker compose up -d --build

# Com dados em produção: muda a senha dentro do banco existente
docker compose exec db psql -U dudaplan -d dudaplan \
  -c "ALTER USER dudaplan WITH PASSWORD 'nova-senha';"
```

Em qualquer um dos casos, `POSTGRES_PASSWORD` e a senha embutida no `DATABASE_URL` precisam ser idênticas.

### Backup

Os dados vivem em dois lugares: o Postgres (projetos, tarefas, notas, transcrições, atas) e o volume `/app/data` (arquivos de áudio das reuniões). Um backup completo precisa dos dois:

```bash
docker compose exec db pg_dump -U dudaplan dudaplan > backup.sql
docker run --rm -v dudaplan_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
```

## Estrutura do projeto

```
src/
  app/            rotas (App Router) e route handlers de API
  components/     UI base (design system) e layout (sidebar, shell)
  features/       componentes client por domínio (checks, projetos, notas, tarefas, reuniões)
  lib/
    ai/           cliente OpenAI, prompts, pipeline de transcrição/análise/fluxograma
    auth/         sessão, guarda de rotas, rate limit do login
    data/         consultas ao Prisma usadas pelos Server Components
    storage/      leitura/escrita dos arquivos de áudio no disco
    validation/   schemas Zod de cada feature
prisma/           schema, migrations e seed
```

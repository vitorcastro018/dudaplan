// Aplica db/migrations/*.sql em ordem, uma vez cada.
//
// Roda no start do container (docker-entrypoint.sh) e localmente com
// `npm run db:migrate`. Sem ferramenta externa: são poucos arquivos SQL, e o
// controle de "já aplicado" cabe numa tabela.
//
// Cada arquivo roda numa transação junto com o registro dele — ou o arquivo
// inteiro entra, ou nada entra, e uma migration que falha no meio não deixa o
// banco num estado que nenhuma versão descreve.
//
// Uma trava de sessão (`pg_advisory_lock`) impede duas instâncias subindo ao
// mesmo tempo (redeploy com o container antigo ainda de pé) de aplicarem a
// mesma migration em paralelo.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const LOCK_ID = 727_001;

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
  await client.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await client.query("select name from schema_migrations")).rows.map((row) => row.name),
  );

  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`migration aplicada: ${file}`);
      count++;
    } catch (error) {
      await client.query("rollback");
      console.error(`migration ${file} falhou: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    console.log(count === 0 ? "banco já está atualizado." : `${count} migration(s) aplicada(s).`);
  }
} finally {
  await client.end();
}

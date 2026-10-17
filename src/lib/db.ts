import pg from "pg";
import { env } from "@/lib/env";

// O driver devolve `date`, `timestamptz`, `numeric` e `int8` como Date/string
// de formatos que o resto do app não espera. O app inteiro trabalha com:
//   * date        -> "AAAA-MM-DD" (string), nunca Date: um Date de meia-noite
//                    local vira o dia anterior ao converter para UTC.
//   * timestamptz -> string ISO em UTC, o mesmo formato que o app já usava.
//   * numeric     -> number (só `position`, que é pequeno).
//   * int8        -> number (só `size_bytes`, muito abaixo de 2^53).
// Registrar aqui, uma vez, evita um parse espalhado por cada consulta.
const { types } = pg;
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1184, (value) => new Date(value).toISOString());
types.setTypeParser(1700, (value) => Number(value));
types.setTypeParser(20, (value) => Number(value));

// Um pool por processo. Em desenvolvimento o hot reload reavalia este módulo e
// abriria um pool novo a cada edição, esgotando as conexões do Postgres — por
// isso fica pendurado no `globalThis`.
const globalForPool = globalThis as unknown as { __dudaplanPool?: pg.Pool };

export const pool =
  globalForPool.__dudaplanPool ??
  new pg.Pool({
    // Sem DATABASE_URL, o driver lê PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPool.__dudaplanPool = pool;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** A primeira linha, ou null. */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

/** Roda várias consultas na mesma transação; desfaz tudo se `fn` lançar. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Tabelas que `updateOwned` aceita — o nome entra no SQL, então é lista fechada. */
type OwnedTable = "tasks" | "projects" | "meetings" | "routines" | "clients";

/**
 * UPDATE de uma linha do usuário a partir de um objeto parcial.
 *
 * Os nomes das colunas vêm do código (as chaves do `patch` são montadas nas
 * actions, nunca do formulário), e os valores sempre vão como parâmetro. Filtra
 * por `user_id` junto do `id`: uma linha de outra conta simplesmente não casa.
 * Devolve `false` quando nenhuma linha foi atualizada.
 */
export async function updateOwned(
  table: OwnedTable,
  id: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const columns = Object.keys(patch);
  if (columns.length === 0) return true;

  for (const column of columns) {
    if (!/^[a-z_]+$/.test(column)) throw new Error(`Coluna inválida: ${column}`);
  }

  const assignments = columns.map((column, index) => `${column} = $${index + 3}`).join(", ");
  const result = await pool.query(
    `update ${table} set ${assignments} where id = $1 and user_id = $2`,
    [id, userId, ...columns.map((column) => patch[column])],
  );
  return (result.rowCount ?? 0) > 0;
}

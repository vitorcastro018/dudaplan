import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { ClientRow } from "@/lib/types";

const CLIENT_FIELDS = "id, name, description, contact, created_at";

export type ClientListItem = Pick<
  ClientRow,
  "id" | "name" | "description" | "contact" | "created_at"
>;

/** O cliente com o que está em aberto, para o card da lista. */
export interface ClientSummary extends ClientListItem {
  activeProjects: number;
  openTasks: number;
  meetings: number;
}

export async function listClients(): Promise<ClientSummary[]> {
  const userId = await requireUser();

  // Contagens por subconsulta correlacionada: a lista é curta e isso evita três
  // `group by` cruzados. "Aberta" é o mesmo recorte de `OPEN` em data/tasks.ts;
  // tarefa de projeto do cliente conta mesmo sem `client_id` próprio.
  return query<ClientSummary>(
    `select c.id, c.name, c.description, c.contact, c.created_at,
            (select count(*)::int from projects p
              where p.client_id = c.id and p.archived_at is null
                and p.status in ('planning','active','on_hold')) as "activeProjects",
            (select count(*)::int from tasks t
              where t.archived_at is null
                and t.status in ('backlog','todo','in_progress','waiting')
                and (t.client_id = c.id
                     or t.project_id in (select id from projects where client_id = c.id))) as "openTasks",
            (select count(*)::int from meetings m
              where m.archived_at is null
                and (m.client_id = c.id
                     or m.project_id in (select id from projects where client_id = c.id))) as "meetings"
       from clients c
      where c.user_id = $1 and c.archived_at is null
      order by lower(c.name)`,
    [userId],
  );
}

/** Só id e nome, para preencher seletores. */
export async function listClientOptions(): Promise<{ id: string; name: string }[]> {
  const userId = await requireUser();
  return query<{ id: string; name: string }>(
    "select id, name from clients where user_id = $1 and archived_at is null order by lower(name)",
    [userId],
  );
}

export async function getClient(clientId: string): Promise<ClientListItem | null> {
  const userId = await requireUser();
  return queryOne<ClientListItem>(
    `select ${CLIENT_FIELDS} from clients where id = $1 and user_id = $2 and archived_at is null`,
    [clientId, userId],
  );
}

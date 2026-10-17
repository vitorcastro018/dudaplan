import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { ProjectRow, ProjectStatus } from "@/lib/types";

const PROJECT_FIELDS =
  "id, client_id, name, problem, outcome, status, start_date, deadline_optimistic, deadline_mediocre, deadline_realistic, completed_at, position, created_at";

export type ProjectListItem = Pick<
  ProjectRow,
  | "id"
  | "client_id"
  | "name"
  | "problem"
  | "outcome"
  | "status"
  | "start_date"
  | "deadline_optimistic"
  | "deadline_mediocre"
  | "deadline_realistic"
  | "completed_at"
  | "position"
  | "created_at"
>;

export async function listProjects(
  status?: ProjectStatus,
  clientId?: string,
): Promise<ProjectListItem[]> {
  const userId = await requireUser();

  const params: unknown[] = [userId];
  let filter = "";
  if (status) {
    params.push(status);
    filter += `and status = $${params.length} `;
  }
  if (clientId) {
    params.push(clientId);
    filter += `and client_id = $${params.length}`;
  }

  return query<ProjectListItem>(
    `select ${PROJECT_FIELDS} from projects
      where user_id = $1 and archived_at is null ${filter}
      order by position, created_at`,
    params,
  );
}

/** Só id e nome, para preencher seletor e rótulo sem carregar a linha inteira. */
export async function listProjectOptions(): Promise<{ id: string; name: string }[]> {
  const userId = await requireUser();
  return query<{ id: string; name: string }>(
    "select id, name from projects where user_id = $1 and archived_at is null order by position",
    [userId],
  );
}

export async function getProject(projectId: string): Promise<ProjectListItem | null> {
  const userId = await requireUser();
  return queryOne<ProjectListItem>(
    `select ${PROJECT_FIELDS} from projects where id = $1 and user_id = $2`,
    [projectId, userId],
  );
}

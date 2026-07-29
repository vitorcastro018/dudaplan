import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import type { ProjectRow, ProjectStatus } from "@/lib/supabase/types";

// Uma string literal só, sem concatenar: o supabase-js infere o formato da
// linha a partir do texto do `select`, e `"a" + "b"` colapsa para `string`,
// levando o retorno a `GenericStringError` em vez das colunas pedidas.
const PROJECT_FIELDS =
  "id, workspace_id, name, problem, outcome, status, start_date, deadline_optimistic, deadline_mediocre, deadline_realistic, completed_at, position, created_at";

export type ProjectListItem = Pick<
  ProjectRow,
  | "id"
  | "workspace_id"
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

export async function listProjects(status?: ProjectStatus): Promise<ProjectListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(PROJECT_FIELDS)
    .is("archived_at", null)
    .order("position")
    .order("created_at");

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new ApiError(500, "project_list_failed", error.message);
  return (data ?? []) as ProjectListItem[];
}

/** Só id e nome, para preencher seletor e rótulo sem carregar a linha inteira. */
export async function listProjectOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .is("archived_at", null)
    .order("position");

  if (error) throw new ApiError(500, "project_options_failed", error.message);
  return data ?? [];
}

export async function getProject(projectId: string): Promise<ProjectListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_FIELDS)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new ApiError(500, "project_read_failed", error.message);
  return (data as ProjectListItem | null) ?? null;
}

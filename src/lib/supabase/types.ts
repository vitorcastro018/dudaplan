// Tipos das tabelas usadas nesta fatia.
//
// Normalmente isto sairia de `supabase gen types typescript`, mas a CLI precisa
// alcançar o projeto e este ambiente não tem rede para o Supabase. Escrito à mão
// a partir de `supabase/migrations/20260728000000_core_schema.sql` — se o schema
// mudar, este arquivo muda junto, ou o `tsc` mente sobre o formato das linhas.
// Assim que a CLI estiver disponível, gere e substitua.

export type TaskStatus = "backlog" | "todo" | "in_progress" | "waiting" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskEnergy = "low" | "medium" | "high";
export type TaskSource = "manual" | "meeting" | "ai" | "inbox" | "recurring";
export type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "cancelled";
export type RoutineCadence = "daily" | "weekdays" | "weekly" | "custom";

export type TaskRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: unknown | null;
  status: TaskStatus;
  priority: TaskPriority;
  energy: TaskEnergy | null;
  assignee_id: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  intention_trigger: string | null;
  blocked_reason: string | null;
  source_type: TaskSource;
  source_meeting_id: string | null;
  source_segment_id: string | null;
  position: number;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectRow = {
  id: string;
  workspace_id: string;
  area_id: string | null;
  name: string;
  /** "como eu sei que terminou" — obrigatório e não vazio (invariante 1). */
  outcome: string;
  description: unknown | null;
  status: ProjectStatus;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RoutineRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  area_id: string | null;
  name: string;
  description: string | null;
  cadence: RoutineCadence;
  active_days: number[] | null;
  target_time: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RoutineLogRow = {
  id: string;
  routine_id: string;
  log_date: string;
  completed: boolean;
  skipped: boolean;
  note: string | null;
  created_at: string;
}

export type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export type MembershipRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "guest";
  created_at: string;
}

export type UserRow = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  timezone: string;
  work_start: string | null;
  work_end: string | null;
  created_at: string;
  updated_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      tasks: Table<
        TaskRow,
        Pick<TaskRow, "workspace_id" | "title"> & Partial<TaskRow>,
        Partial<TaskRow>
      >;
      projects: Table<
        ProjectRow,
        Pick<ProjectRow, "workspace_id" | "name" | "outcome"> & Partial<ProjectRow>,
        Partial<ProjectRow>
      >;
      routines: Table<
        RoutineRow,
        Pick<RoutineRow, "workspace_id" | "user_id" | "name"> & Partial<RoutineRow>,
        Partial<RoutineRow>
      >;
      routine_logs: Table<
        RoutineLogRow,
        Pick<RoutineLogRow, "routine_id" | "log_date"> & Partial<RoutineLogRow>,
        Partial<RoutineLogRow>
      >;
      workspaces: Table<WorkspaceRow, Pick<WorkspaceRow, "name" | "owner_id">>;
      memberships: Table<MembershipRow, Pick<MembershipRow, "workspace_id" | "user_id">>;
      users: Table<UserRow, Pick<UserRow, "id" | "email" | "name">>;
    };
    // `{ [_ in never]: never }` e não `Record<string, never>`: o segundo diz
    // "qualquer chave mapeia para never", o que não satisfaz a restrição de
    // schema do postgrest-js. O tipo inteiro deixa de casar e o cliente cai num
    // fallback onde todo insert é inferido como `never[]`.
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

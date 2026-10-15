// Formato das linhas do banco. Escrito à mão a partir de
// `db/migrations/0001_init.sql` — se o schema mudar, este arquivo muda junto.
//
// As datas chegam como string porque `src/lib/db.ts` registra os parsers do
// driver: `date` vira "AAAA-MM-DD" e `timestamptz` vira ISO em UTC.

export type TaskStatus = "backlog" | "todo" | "in_progress" | "waiting" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskEnergy = "low" | "medium" | "high";
export type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "cancelled";
export type RoutineCadence = "daily" | "weekdays" | "weekly" | "custom";
export type RoutineShift = "morning" | "afternoon" | "night";
export type MeetingStatus = "scheduled" | "recording" | "processing" | "ready" | "failed";

export type TaskRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  energy: TaskEnergy | null;
  scheduled_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  blocked_reason: string | null;
  position: number;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  /** "por que este projeto existe" — obrigatório e não vazio. */
  problem: string;
  /** "como eu sei que terminou" — obrigatório e não vazio. */
  outcome: string;
  status: ProjectStatus;
  start_date: string | null;
  /**
   * Os três prazos, todos obrigatórios. Não há ordem garantida entre eles: o
   * banco não impõe nenhuma, então nada aqui pode assumir que otimista < realista.
   */
  deadline_optimistic: string;
  deadline_mediocre: string;
  deadline_realistic: string;
  completed_at: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cadence: RoutineCadence;
  active_days: number[] | null;
  target_time: string | null;
  /** Endereço que a rotina abre. Só `http`/`https` — ver validation/routines.ts. */
  link: string | null;
  /** Turno do dia. Nulo é caso normal: rotina sem hora marcada. */
  shift: RoutineShift | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  /** Anotações em texto livre, renderizadas como Markdown na tela. */
  notes: string | null;
  scheduled_at: string | null;
  duration_sec: number | null;
  status: MeetingStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingParticipantRow = {
  id: string;
  meeting_id: string;
  name: string;
};

export type RecordingRow = {
  id: string;
  meeting_id: string;
  /** Caminho relativo a UPLOAD_DIR — ver src/lib/storage/audio.ts. */
  storage_path: string;
  mime_type: string;
  size_bytes: number | null;
  duration_sec: number | null;
  created_at: string;
};

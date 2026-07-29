import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import { formatDateTimeLabel, utcIsoToLocalDateTimeInput } from "@/lib/date";
import type { MeetingRow, MeetingParticipantRow, RecordingRow } from "@/lib/supabase/types";

// Uma string literal só, sem concatenar: o supabase-js infere o formato da
// linha a partir do texto do `select`, e `"a" + "b"` colapsa para `string`,
// levando o retorno a `GenericStringError` em vez das colunas pedidas.
const MEETING_FIELDS =
  "id, workspace_id, project_id, title, notes, scheduled_at, duration_sec, status, created_at, updated_at";

export type MeetingListItem = Pick<
  MeetingRow,
  | "id"
  | "workspace_id"
  | "project_id"
  | "title"
  | "notes"
  | "scheduled_at"
  | "duration_sec"
  | "status"
  | "created_at"
  | "updated_at"
>;

export type MeetingParticipant = Pick<MeetingParticipantRow, "id" | "external_name" | "user_id">;

export interface MeetingSummary extends MeetingListItem {
  projectName: string | null;
  participantCount: number;
  hasAudio: boolean;
  /**
   * `scheduled_at` já por extenso.
   *
   * Formatado aqui, no servidor, e não no componente: só o servidor conhece o
   * `APP_TIMEZONE`, e formatar no navegador mostraria a reunião no fuso de quem
   * está olhando — que é justamente o que este app não quer.
   */
  scheduledLabel: string | null;
}

export interface MeetingDetail extends MeetingListItem {
  participants: MeetingParticipant[];
  recording: RecordingRow | null;
  scheduledLabel: string | null;
  /** `scheduled_at` no formato do `<input type="datetime-local">`. */
  scheduledInput: string | null;
}

/**
 * A lista de reuniões, já com nome do projeto, contagem de participantes e se
 * há áudio.
 *
 * Consultas separadas em vez de embedding do PostgREST (`select("*,
 * projects(name)")`): `src/lib/supabase/types.ts` é escrito à mão e declara
 * `Relationships: []`, então o embedding não tipa e o retorno degrada para
 * `GenericStringError`. É o mesmo caminho que `getRoutineBoard` já toma, pelo
 * mesmo motivo — e o cruzamento por `Map` é barato numa lista dessa ordem.
 *
 * Sem filtro por workspace, de propósito: o RLS já restringe a leitura. Ver a
 * nota em `src/lib/data/tasks.ts`.
 */
export async function listMeetings(): Promise<MeetingSummary[]> {
  const supabase = await createClient();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select(MEETING_FIELDS)
    .is("archived_at", null)
    // `nullsFirst: false` para que reunião sem data marcada caia no fim, e não
    // no topo empurrando as agendadas para baixo.
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new ApiError(500, "meeting_list_failed", error.message);

  return enrichMeetings((meetings ?? []) as MeetingListItem[]);
}

/**
 * As reuniões de um projeto, para a aba do projeto — o mesmo recorte que
 * `listProjectTasks` faz com as tarefas.
 *
 * Filtra por `project_id` na consulta, e não em memória depois de trazer tudo:
 * a nota em `listTasks` vale igual aqui. O RLS continua cuidando do workspace.
 */
export async function listProjectMeetings(projectId: string): Promise<MeetingSummary[]> {
  const supabase = await createClient();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select(MEETING_FIELDS)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new ApiError(500, "meeting_list_failed", error.message);

  return enrichMeetings((meetings ?? []) as MeetingListItem[]);
}

/**
 * Cruza uma lista de reuniões com participantes, gravações e nome do projeto.
 *
 * Consultas separadas em vez de embedding do PostgREST (`select("*,
 * projects(name)")`): `src/lib/supabase/types.ts` é escrito à mão e declara
 * `Relationships: []`, então o embedding não tipa e o retorno degrada para
 * `GenericStringError`. É o mesmo caminho que `getRoutineBoard` já toma, pelo
 * mesmo motivo — e o cruzamento por `Map` é barato numa lista dessa ordem.
 */
async function enrichMeetings(rows: MeetingListItem[]): Promise<MeetingSummary[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const ids = rows.map((meeting) => meeting.id);
  const projectIds = [...new Set(rows.map((m) => m.project_id).filter((id): id is string => !!id))];

  const [participants, recordings, projects] = await Promise.all([
    supabase.from("meeting_participants").select("meeting_id").in("meeting_id", ids),
    supabase.from("recordings").select("meeting_id").in("meeting_id", ids),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (participants.error)
    throw new ApiError(500, "meeting_participants_failed", participants.error.message);
  if (recordings.error)
    throw new ApiError(500, "meeting_recordings_failed", recordings.error.message);
  if (projects.error) throw new ApiError(500, "meeting_projects_failed", projects.error.message);

  const countByMeeting = new Map<string, number>();
  for (const row of participants.data ?? []) {
    countByMeeting.set(row.meeting_id, (countByMeeting.get(row.meeting_id) ?? 0) + 1);
  }

  const withAudio = new Set((recordings.data ?? []).map((row) => row.meeting_id));
  const projectName = new Map((projects.data ?? []).map((row) => [row.id, row.name]));

  return rows.map((meeting) => ({
    ...meeting,
    projectName: meeting.project_id ? (projectName.get(meeting.project_id) ?? null) : null,
    participantCount: countByMeeting.get(meeting.id) ?? 0,
    hasAudio: withAudio.has(meeting.id),
    scheduledLabel: meeting.scheduled_at ? formatDateTimeLabel(meeting.scheduled_at) : null,
  }));
}

export async function getMeeting(meetingId: string): Promise<MeetingDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_FIELDS)
    .eq("id", meetingId)
    .maybeSingle();

  if (error) throw new ApiError(500, "meeting_read_failed", error.message);
  if (!data) return null;

  const meeting = data as MeetingListItem;

  const [participants, recording] = await Promise.all([
    supabase
      .from("meeting_participants")
      .select("id, external_name, user_id")
      .eq("meeting_id", meetingId),
    // `maybeSingle` e não `single`: reunião sem áudio é o estado inicial de
    // toda reunião, não um erro.
    supabase
      .from("recordings")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (participants.error)
    throw new ApiError(500, "meeting_participants_failed", participants.error.message);
  if (recording.error) throw new ApiError(500, "meeting_recording_failed", recording.error.message);

  return {
    ...meeting,
    participants: (participants.data ?? []) as MeetingParticipant[],
    recording: (recording.data as RecordingRow | null) ?? null,
    scheduledLabel: meeting.scheduled_at ? formatDateTimeLabel(meeting.scheduled_at) : null,
    scheduledInput: meeting.scheduled_at ? utcIsoToLocalDateTimeInput(meeting.scheduled_at) : null,
  };
}

/** Só o caminho do arquivo, para a rota que serve o áudio. */
export async function getMeetingRecording(meetingId: string): Promise<RecordingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new ApiError(500, "meeting_recording_failed", error.message);
  return (data as RecordingRow | null) ?? null;
}

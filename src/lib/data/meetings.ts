import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  dayRangeUtc,
  formatDateTimeLabel,
  formatTimeLabel,
  utcIsoToLocalDateTimeInput,
} from "@/lib/date";
import { parseImprovement, type ProcessImprovement } from "@/lib/ai/improvement";
import type { MeetingRow, MeetingParticipantRow, RecordingRow } from "@/lib/types";

const MEETING_FIELDS =
  "id, project_id, client_id, title, notes, scheduled_at, duration_sec, status, created_at, updated_at";

export type MeetingListItem = Pick<
  MeetingRow,
  | "id"
  | "project_id"
  | "client_id"
  | "title"
  | "notes"
  | "scheduled_at"
  | "duration_sec"
  | "status"
  | "created_at"
  | "updated_at"
>;

export type MeetingParticipant = Pick<MeetingParticipantRow, "id" | "name">;

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
  /** Só a hora ("14:30"), no mesmo fuso, para a agenda de "Hoje". */
  scheduledTime: string | null;
}

export interface MeetingDetail extends MeetingListItem {
  transcript: string | null;
  summary: string | null;
  summaryLabel: string | null;
  improvement: ProcessImprovement | null;
  improvementLabel: string | null;
  participants: MeetingParticipant[];
  recording: RecordingRow | null;
  scheduledLabel: string | null;
  /** `scheduled_at` no formato do `<input type="datetime-local">`. */
  scheduledInput: string | null;
}

/** A lista de reuniões, já com nome do projeto, contagem de participantes e se há áudio. */
export async function listMeetings(): Promise<MeetingSummary[]> {
  const userId = await requireUser();

  // `nulls last` para que reunião sem data marcada caia no fim, e não no topo
  // empurrando as agendadas para baixo.
  const meetings = await query<MeetingListItem>(
    `select ${MEETING_FIELDS} from meetings
      where user_id = $1 and archived_at is null
      order by scheduled_at desc nulls last, created_at desc`,
    [userId],
  );

  return enrichMeetings(userId, meetings);
}

/** As reuniões de um projeto, para a aba do projeto. */
export async function listProjectMeetings(projectId: string): Promise<MeetingSummary[]> {
  const userId = await requireUser();

  const meetings = await query<MeetingListItem>(
    `select ${MEETING_FIELDS} from meetings
      where user_id = $1 and project_id = $2 and archived_at is null
      order by scheduled_at desc nulls last, created_at desc`,
    [userId, projectId],
  );

  return enrichMeetings(userId, meetings);
}

/** As reuniões de um cliente: as ligadas direto a ele e as dos projetos dele. */
export async function listClientMeetings(clientId: string): Promise<MeetingSummary[]> {
  const userId = await requireUser();

  const meetings = await query<MeetingListItem>(
    `select ${MEETING_FIELDS} from meetings
      where user_id = $1 and archived_at is null
        and (client_id = $2
             or project_id in (select id from projects where client_id = $2 and user_id = $1))
      order by scheduled_at desc nulls last, created_at desc`,
    [userId, clientId],
  );

  return enrichMeetings(userId, meetings);
}

/**
 * As reuniões marcadas para o dia, da mais cedo para a mais tarde — a faixa de
 * agenda da tela "Hoje". O intervalo vem de `dayRangeUtc` porque `scheduled_at`
 * é `timestamptz`.
 */
export async function listMeetingsOnDay(dateKey: string): Promise<MeetingSummary[]> {
  const userId = await requireUser();
  const { start, end } = dayRangeUtc(dateKey);

  const meetings = await query<MeetingListItem>(
    `select ${MEETING_FIELDS} from meetings
      where user_id = $1 and archived_at is null
        and scheduled_at >= $2 and scheduled_at < $3
      order by scheduled_at`,
    [userId, start, end],
  );

  return enrichMeetings(userId, meetings);
}

/**
 * Cruza uma lista de reuniões com participantes, gravações e nome do projeto.
 * Consultas separadas e cruzamento por `Map`: simples, e barato numa lista
 * dessa ordem.
 */
async function enrichMeetings(userId: string, rows: MeetingListItem[]): Promise<MeetingSummary[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((meeting) => meeting.id);

  const [participants, recordings, projects] = await Promise.all([
    query<{ meeting_id: string; total: number }>(
      `select meeting_id, count(*)::int as total from meeting_participants
        where meeting_id = any($1::uuid[]) group by meeting_id`,
      [ids],
    ),
    query<{ meeting_id: string }>(
      "select distinct meeting_id from recordings where meeting_id = any($1::uuid[])",
      [ids],
    ),
    query<{ id: string; name: string }>("select id, name from projects where user_id = $1", [
      userId,
    ]),
  ]);

  const countByMeeting = new Map(participants.map((row) => [row.meeting_id, row.total]));
  const withAudio = new Set(recordings.map((row) => row.meeting_id));
  const projectName = new Map(projects.map((row) => [row.id, row.name]));

  return rows.map((meeting) => ({
    ...meeting,
    projectName: meeting.project_id ? (projectName.get(meeting.project_id) ?? null) : null,
    participantCount: countByMeeting.get(meeting.id) ?? 0,
    hasAudio: withAudio.has(meeting.id),
    scheduledLabel: meeting.scheduled_at ? formatDateTimeLabel(meeting.scheduled_at) : null,
    scheduledTime: meeting.scheduled_at ? formatTimeLabel(meeting.scheduled_at) : null,
  }));
}

export async function getMeeting(meetingId: string): Promise<MeetingDetail | null> {
  const userId = await requireUser();

  const meeting = await queryOne<MeetingListItem>(
    `select ${MEETING_FIELDS} from meetings where id = $1 and user_id = $2`,
    [meetingId, userId],
  );
  if (!meeting) return null;

  const [participants, recording, ai] = await Promise.all([
    query<MeetingParticipant>("select id, name from meeting_participants where meeting_id = $1", [
      meetingId,
    ]),
    // `queryOne`: reunião sem áudio é o estado inicial de toda reunião, não um erro.
    queryOne<RecordingRow>(
      "select * from recordings where meeting_id = $1 order by created_at desc limit 1",
      [meetingId],
    ),
    // Fora de `MEETING_FIELDS` para a lista não carregar a transcrição inteira
    // de cada reunião.
    queryOne<{
      transcript: string | null;
      summary: string | null;
      summarized_at: string | null;
      improvement: unknown;
      improved_at: string | null;
    }>(
      "select transcript, summary, summarized_at, improvement, improved_at from meetings where id = $1",
      [meetingId],
    ),
  ]);

  return {
    ...meeting,
    transcript: ai?.transcript ?? null,
    summary: ai?.summary ?? null,
    summaryLabel: ai?.summarized_at ? formatDateTimeLabel(ai.summarized_at) : null,
    improvement: ai?.improvement ? parseImprovement(ai.improvement) : null,
    improvementLabel: ai?.improved_at ? formatDateTimeLabel(ai.improved_at) : null,
    participants,
    recording,
    scheduledLabel: meeting.scheduled_at ? formatDateTimeLabel(meeting.scheduled_at) : null,
    scheduledInput: meeting.scheduled_at ? utcIsoToLocalDateTimeInput(meeting.scheduled_at) : null,
  };
}

/** A gravação da reunião, para a rota que serve o áudio. Confere a posse. */
export async function getMeetingRecording(meetingId: string): Promise<RecordingRow | null> {
  const userId = await requireUser();
  return queryOne<RecordingRow>(
    `select r.* from recordings r join meetings m on m.id = r.meeting_id
      where r.meeting_id = $1 and m.user_id = $2
      order by r.created_at desc limit 1`,
    [meetingId, userId],
  );
}

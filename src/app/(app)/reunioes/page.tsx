import { PageHeader } from "@/components/layout/page-header";
import { listMeetings } from "@/lib/data/meetings";
import { listProjectOptions } from "@/lib/data/projects";
import { utcIsoToLocalDateTimeInput } from "@/lib/date";
import { MeetingList } from "@/features/meetings/meeting-list";

export const dynamic = "force-dynamic";

export default async function ReunioesPage() {
  const [meetings, projects] = await Promise.all([listMeetings(), listProjectOptions()]);

  // Sugestão de data/hora calculada no servidor, para respeitar o APP_TIMEZONE
  // em vez do fuso do navegador — é o mesmo horário que a reunião vai gravar.
  const now = utcIsoToLocalDateTimeInput(new Date().toISOString());

  return (
    <div>
      <PageHeader
        title="Reuniões"
        description="Título, data, participantes, anotações e o áudio de cada encontro."
      />
      <MeetingList meetings={meetings} projects={projects} defaultScheduledAt={now} />
    </div>
  );
}

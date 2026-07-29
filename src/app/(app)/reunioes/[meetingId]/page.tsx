import { notFound } from "next/navigation";
import { UnderlineTabs } from "@/components/ui/tabs";
import { getMeeting } from "@/lib/data/meetings";
import { getProject, listProjectOptions } from "@/lib/data/projects";
import { MeetingDetail } from "@/features/meetings/meeting-detail";
import { MeetingActions } from "@/features/meetings/meeting-actions";
import { MeetingAudio } from "@/features/meetings/meeting-audio";

export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ meetingId }, { aba }] = await Promise.all([params, searchParams]);

  // O RLS já devolve null para reunião de outro workspace, então "não achou" e
  // "não é sua" chegam aqui do mesmo jeito — que é o que se quer: um 404 não
  // revela que o recurso existe em outra conta.
  const meeting = await getMeeting(meetingId);
  if (!meeting) notFound();

  const [projects, project] = await Promise.all([
    listProjectOptions(),
    meeting.project_id ? getProject(meeting.project_id) : Promise.resolve(null),
  ]);

  // A aba vive na URL, e não em estado de cliente: assim ela sobrevive a
  // recarregar a página e pode ser compartilhada por link. Mesmo padrão do
  // `?projeto=` em /tarefas.
  const audioTab = aba === "audio";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-ink text-3xl font-medium tracking-tight">
          {meeting.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <MeetingActions meeting={meeting} projects={projects} />
        </div>
      </div>

      <UnderlineTabs
        items={[
          { label: "Detalhes", href: `/reunioes/${meeting.id}`, active: !audioTab },
          { label: "Áudio", href: `/reunioes/${meeting.id}?aba=audio`, active: audioTab },
        ]}
      />

      {audioTab ? (
        <MeetingAudio meetingId={meeting.id} recording={meeting.recording} />
      ) : (
        <MeetingDetail meeting={meeting} projectName={project?.name ?? null} />
      )}
    </div>
  );
}

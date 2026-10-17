import { Fragment } from "react";
import { notFound } from "next/navigation";
import { UnderlineTabs } from "@/components/ui/tabs";
import { getMeeting } from "@/lib/data/meetings";
import { getProject, listProjectOptions } from "@/lib/data/projects";
import { MeetingDetail } from "@/features/meetings/meeting-detail";
import { MeetingActions } from "@/features/meetings/meeting-actions";
import { MeetingAudio } from "@/features/meetings/meeting-audio";
import { MeetingSummary } from "@/features/meetings/meeting-summary";
import { MeetingActionItems } from "@/features/meetings/meeting-action-items";
import { MeetingDiagnosis } from "@/features/meetings/meeting-diagnosis";
import { MeetingImprovement } from "@/features/meetings/meeting-improvement";

export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ meetingId }, { aba }] = await Promise.all([params, searchParams]);

  // A consulta filtra por usuário e devolve null para reunião de outra conta, então "não achou" e
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

  // Na aba Detalhes só aparecem as seções de IA que já foram geradas, com uma
  // divisória entre elas (e nenhuma sobrando na ponta).
  const sections = [
    meeting.summary && { key: "summary", node: <MeetingSummary meeting={meeting} /> },
    meeting.actionItemsLabel && { key: "actions", node: <MeetingActionItems meeting={meeting} /> },
    meeting.diagnosis && { key: "diagnosis", node: <MeetingDiagnosis meeting={meeting} /> },
    meeting.improvement && { key: "improvement", node: <MeetingImprovement meeting={meeting} /> },
  ].filter((section) => !!section);

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
        <>
          <MeetingAudio meetingId={meeting.id} recording={meeting.recording} />
          <MeetingSummary meeting={meeting} />
          <hr className="border-line my-4" />
          <MeetingActionItems meeting={meeting} />
          <hr className="border-line my-4" />
          <MeetingDiagnosis meeting={meeting} />
          <hr className="border-line my-4" />
          <MeetingImprovement meeting={meeting} />
        </>
      ) : (
        <>
          <MeetingDetail meeting={meeting} projectName={project?.name ?? null} />
          {sections.map((section, i) => (
            <Fragment key={section.key}>
              {i > 0 && <hr className="border-line my-4" />}
              {section.node}
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}

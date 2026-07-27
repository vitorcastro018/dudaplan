import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import { listProjectMeetings } from "@/lib/data/meetings";
import { MeetingList } from "@/features/meetings/meeting-list";

export default async function ProjectReunioesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const meetings = await listProjectMeetings(project.id);

  return (
    <MeetingList
      projectId={project.id}
      projectSlug={project.slug}
      initialMeetings={meetings.map((meeting) => ({
        ...meeting,
        meetingDate: meeting.meetingDate.toISOString(),
      }))}
    />
  );
}

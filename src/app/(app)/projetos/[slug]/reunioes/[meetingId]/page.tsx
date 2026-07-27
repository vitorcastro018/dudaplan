import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProjectBySlug } from "@/lib/data/projects";
import { getMeetingById } from "@/lib/data/meetings";
import { MeetingDetail } from "@/features/meetings/meeting-detail";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ slug: string; meetingId: string }>;
}) {
  const { slug, meetingId } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const meeting = await getMeetingById(meetingId);
  if (!meeting || meeting.projectId !== project.id) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/projetos/${slug}/reunioes`}
          className="text-ink-muted hover:text-ink flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Reuniões
        </Link>
      </div>
      <h1 className="font-display text-ink mb-6 text-2xl font-medium tracking-tight">
        {meeting.title}
      </h1>
      <MeetingDetail
        initialMeeting={{
          id: meeting.id,
          title: meeting.title,
          meetingDate: meeting.meetingDate.toISOString(),
          participants: meeting.participants,
          contextNotes: meeting.contextNotes,
          status: meeting.status,
          audioPath: meeting.audioPath,
          durationSeconds: meeting.durationSeconds,
        }}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";

export function listProjectMeetings(projectId: string) {
  return prisma.meeting.findMany({
    where: { projectId },
    orderBy: { meetingDate: "desc" },
    select: {
      id: true,
      title: true,
      meetingDate: true,
      status: true,
      durationSeconds: true,
      participants: true,
    },
  });
}

export function getMeetingById(meetingId: string) {
  return prisma.meeting.findUnique({ where: { id: meetingId } });
}

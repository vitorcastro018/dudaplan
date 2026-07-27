import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { listProjectMeetings } from "@/lib/data/meetings";
import { createMeetingSchema } from "@/lib/validation/meetings";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const meetings = await listProjectMeetings(projectId);
    return ok(meetings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const body = createMeetingSchema.parse(await request.json());
    const meeting = await prisma.meeting.create({
      data: {
        projectId,
        title: body.title,
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : new Date(),
        participants: body.participants,
        contextNotes: body.contextNotes,
      },
    });

    return ok(meeting, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { updateMeetingSchema } from "@/lib/validation/meetings";
import { deleteMeetingAudioDir } from "@/lib/storage/audio";
import { ok, unauthorized, notFound, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return notFound();

    return ok(meeting);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const body = updateMeetingSchema.parse(await request.json());
    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...body,
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : undefined,
      },
    });

    return ok(meeting);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const existing = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!existing) return notFound();

    await prisma.meeting.delete({ where: { id: meetingId } });
    await deleteMeetingAudioDir(meetingId);

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

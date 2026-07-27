import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { reconcileStuckMeetings } from "@/lib/ai/pipeline";
import { ok, unauthorized, notFound, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    await reconcileStuckMeetings();

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, errorMessage: true, updatedAt: true },
    });
    if (!meeting) return notFound();

    return ok(meeting);
  } catch (error) {
    return handleApiError(error);
  }
}

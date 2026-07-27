import { after } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { runMeetingPipeline, reconcileStuckMeetings } from "@/lib/ai/pipeline";
import { ok, unauthorized, notFound, fail, handleApiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;
    const force = request.nextUrl.searchParams.get("force") === "1";

    await reconcileStuckMeetings();

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return notFound();

    const eligible =
      meeting.status === "UPLOADED" ||
      meeting.status === "FAILED" ||
      (meeting.status === "COMPLETED" && force);

    if (!eligible) {
      return fail(
        409,
        "not_eligible",
        "Esta reunião já está sendo processada ou não possui áudio enviado.",
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "TRANSCRIBING",
        processingStartedAt: new Date(),
        attempts: { increment: 1 },
        errorMessage: null,
      },
    });

    after(() => runMeetingPipeline(meetingId));

    return ok({ status: updated.status }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

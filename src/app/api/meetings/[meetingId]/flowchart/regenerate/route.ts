import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { generateMeetingFlowchart } from "@/lib/ai/flowchart";
import { ok, unauthorized, notFound, fail, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return notFound();
    if (!meeting.summaryMarkdown) {
      return fail(409, "not_ready", "A reunião ainda não possui uma ata gerada pela IA.");
    }

    const flowchart = await generateMeetingFlowchart({
      summaryMarkdown: meeting.summaryMarkdown,
      problems: meeting.problems,
      actionPlan: meeting.actionPlan,
    });

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { flowchartMermaid: flowchart.mermaid, flowchartTitle: flowchart.title },
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

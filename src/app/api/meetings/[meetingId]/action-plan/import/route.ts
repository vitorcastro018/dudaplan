import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { ok, unauthorized, notFound, fail, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

const importSchema = z.object({ indexes: z.array(z.number().int().min(0)) });

const actionItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  owner: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueHint: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const { indexes } = importSchema.parse(await request.json());

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return notFound();

    const actionPlan = z
      .array(actionItemSchema)
      .catch([])
      .parse(meeting.actionPlan ?? []);
    const selected = indexes.map((i) => actionPlan[i]).filter(Boolean);

    if (selected.length === 0) {
      return fail(400, "nothing_selected", "Nenhum item válido do plano de ação foi selecionado.");
    }

    const last = await prisma.projectTask.findFirst({
      where: { projectId: meeting.projectId, status: "TODO" },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    let position = (last?.position ?? -1) + 1;
    const tasks = await prisma.$transaction(
      selected.map((item) =>
        prisma.projectTask.create({
          data: {
            projectId: meeting.projectId,
            title: item.title,
            description: item.owner
              ? `${item.description}\n\nResponsável: ${item.owner}`
              : item.description,
            priority: item.priority ?? "MEDIUM",
            origin: "MEETING_AI",
            sourceMeetingId: meeting.id,
            position: position++,
          },
        }),
      ),
    );

    return ok(tasks, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

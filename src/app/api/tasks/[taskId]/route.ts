import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { updateTaskSchema } from "@/lib/validation/tasks";
import { ok, unauthorized, notFound, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { taskId } = await params;

    const body = updateTaskSchema.parse(await request.json());

    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...body,
        dueDate:
          body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
        completedAt: body.status ? (body.status === "DONE" ? new Date() : null) : undefined,
      },
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { taskId } = await params;

    const existing = await prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!existing) return notFound();

    await prisma.projectTask.delete({ where: { id: taskId } });
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

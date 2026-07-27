import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { listProjectTasks } from "@/lib/data/tasks";
import { createTaskSchema } from "@/lib/validation/tasks";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const tasks = await listProjectTasks(projectId);
    return ok(tasks);
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

    const body = createTaskSchema.parse(await request.json());
    const last = await prisma.projectTask.findFirst({
      where: { projectId, status: body.status },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const task = await prisma.projectTask.create({
      data: {
        projectId,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        position: (last?.position ?? -1) + 1,
      },
    });

    return ok(task, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

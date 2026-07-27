import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { updateProjectSchema } from "@/lib/validation/projects";
import { ok, unauthorized, notFound, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound();

    return ok(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const body = updateProjectSchema.parse(await request.json());
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...body,
        startDate:
          body.startDate !== undefined
            ? body.startDate
              ? new Date(body.startDate)
              : null
            : undefined,
        dueDate:
          body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      },
    });

    return ok(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) return notFound();

    await prisma.project.delete({ where: { id: projectId } });
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

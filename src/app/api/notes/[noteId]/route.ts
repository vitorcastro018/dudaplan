import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { updateNoteSchema } from "@/lib/validation/notes";
import { ok, unauthorized, notFound, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { noteId } = await params;

    const body = updateNoteSchema.parse(await request.json());
    const note = await prisma.projectNote.update({ where: { id: noteId }, data: body });
    return ok(note);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { noteId } = await params;

    const existing = await prisma.projectNote.findUnique({ where: { id: noteId } });
    if (!existing) return notFound();

    await prisma.projectNote.delete({ where: { id: noteId } });
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

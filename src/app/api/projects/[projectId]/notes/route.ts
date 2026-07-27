import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { listProjectNotes } from "@/lib/data/notes";
import { createNoteSchema } from "@/lib/validation/notes";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { projectId } = await params;

    const notes = await listProjectNotes(projectId);
    return ok(notes);
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

    const body = createNoteSchema.parse(await request.json());
    const note = await prisma.projectNote.create({ data: { ...body, projectId } });
    return ok(note, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

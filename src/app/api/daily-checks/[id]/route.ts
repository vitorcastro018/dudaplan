import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { updateDailyCheckSchema } from "@/lib/validation/daily-checks";
import { ok, unauthorized, notFound, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { id } = await params;

    const body = updateDailyCheckSchema.parse(await request.json());
    const check = await prisma.dailyCheck.update({ where: { id }, data: body });
    return ok(check);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { id } = await params;

    const existing = await prisma.dailyCheck.findUnique({ where: { id } });
    if (!existing) return notFound();

    await prisma.dailyCheck.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

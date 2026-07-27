import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { toggleDailyCheckSchema } from "@/lib/validation/daily-checks";
import { dateKeyToDate } from "@/lib/date";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { id: dailyCheckId } = await params;

    const { date, done } = toggleDailyCheckSchema.parse(await request.json());
    const dateValue = dateKeyToDate(date);

    if (done) {
      await prisma.dailyCheckCompletion.upsert({
        where: { dailyCheckId_date: { dailyCheckId, date: dateValue } },
        update: {},
        create: { dailyCheckId, date: dateValue },
      });
    } else {
      await prisma.dailyCheckCompletion
        .delete({ where: { dailyCheckId_date: { dailyCheckId, date: dateValue } } })
        .catch(() => null);
    }

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

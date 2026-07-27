import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { listChecksForDate } from "@/lib/data/daily-checks";
import { createDailyCheckSchema } from "@/lib/validation/daily-checks";
import { todayKey, isValidDateKey } from "@/lib/date";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();

    const dateParam = request.nextUrl.searchParams.get("date");
    const dateKey = dateParam && isValidDateKey(dateParam) ? dateParam : todayKey();

    const checks = await listChecksForDate(dateKey);
    return ok({ date: dateKey, checks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();

    const body = createDailyCheckSchema.parse(await request.json());
    const last = await prisma.dailyCheck.findFirst({
      where: { isArchived: false },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const check = await prisma.dailyCheck.create({
      data: { ...body, position: (last?.position ?? -1) + 1 },
    });

    return ok(check, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

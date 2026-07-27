import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guard";
import { getDailyChecksSummary } from "@/lib/data/daily-checks";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();

    const daysParam = Number(request.nextUrl.searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 120) : 30;

    const summary = await getDailyChecksSummary(days);
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

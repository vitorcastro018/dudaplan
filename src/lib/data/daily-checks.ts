import { prisma } from "@/lib/prisma";
import { dateKeyToDate, shiftDateKey } from "@/lib/date";

const STREAK_LOOKBACK_DAYS = 400;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeStreak(
  weekdays: number[],
  completedDates: Set<string>,
  fromDateKey: string,
): number {
  let streak = 0;
  let cursor = fromDateKey;

  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    const weekday = dateKeyToDate(cursor).getUTCDay();
    if (!weekdays.includes(weekday)) {
      cursor = shiftDateKey(cursor, -1);
      continue;
    }
    if (completedDates.has(cursor)) {
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
    } else {
      break;
    }
  }

  return streak;
}

export interface DailyCheckWithStatus {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  colorToken: string;
  weekdays: number[];
  isDone: boolean;
  streak: number;
}

export async function listChecksForDate(dateKey: string): Promise<DailyCheckWithStatus[]> {
  const weekday = dateKeyToDate(dateKey).getUTCDay();

  const checks = await prisma.dailyCheck.findMany({
    where: { isArchived: false, weekdays: { has: weekday } },
    orderBy: { position: "asc" },
  });

  if (checks.length === 0) return [];

  const lookbackStart = dateKeyToDate(shiftDateKey(dateKey, -STREAK_LOOKBACK_DAYS));
  const completions = await prisma.dailyCheckCompletion.findMany({
    where: {
      dailyCheckId: { in: checks.map((c) => c.id) },
      date: { gte: lookbackStart, lte: dateKeyToDate(dateKey) },
    },
    select: { dailyCheckId: true, date: true },
  });

  const completedByCheck = new Map<string, Set<string>>();
  for (const completion of completions) {
    const key = toDateKey(completion.date);
    const set = completedByCheck.get(completion.dailyCheckId) ?? new Set<string>();
    set.add(key);
    completedByCheck.set(completion.dailyCheckId, set);
  }

  return checks.map((check) => {
    const completedDates = completedByCheck.get(check.id) ?? new Set<string>();
    return {
      id: check.id,
      title: check.title,
      description: check.description,
      emoji: check.emoji,
      colorToken: check.colorToken,
      weekdays: check.weekdays,
      isDone: completedDates.has(dateKey),
      streak: computeStreak(check.weekdays, completedDates, dateKey),
    };
  });
}

export async function listActiveDailyChecks() {
  return prisma.dailyCheck.findMany({
    where: { isArchived: false },
    orderBy: { position: "asc" },
  });
}

export interface DailyChecksSummary {
  dateKeys: string[];
  checks: { id: string; title: string; emoji: string | null; colorToken: string }[];
  completions: Record<string, string[]>;
}

export async function getDailyChecksSummary(days: number): Promise<DailyChecksSummary> {
  const today = toDateKey(new Date());
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dateKeys.push(shiftDateKey(today, -i));
  }

  const checks = await prisma.dailyCheck.findMany({
    where: { isArchived: false },
    orderBy: { position: "asc" },
    select: { id: true, title: true, emoji: true, colorToken: true },
  });

  const completions = await prisma.dailyCheckCompletion.findMany({
    where: {
      dailyCheckId: { in: checks.map((c) => c.id) },
      date: { gte: dateKeyToDate(dateKeys[0]), lte: dateKeyToDate(today) },
    },
    select: { dailyCheckId: true, date: true },
  });

  const completionsByCheck: Record<string, string[]> = {};
  for (const completion of completions) {
    const key = toDateKey(completion.date);
    completionsByCheck[completion.dailyCheckId] ??= [];
    completionsByCheck[completion.dailyCheckId].push(key);
  }

  return { dateKeys, checks, completions: completionsByCheck };
}

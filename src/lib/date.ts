import { env } from "@/lib/env";

export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE }).format(new Date());
}

export function dateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = dateKeyToDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateKeyLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(dateKeyToDate(dateKey));
}

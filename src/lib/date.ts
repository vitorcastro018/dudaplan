import { env } from "@/lib/env";

// Intl only accepts IANA zone names, and throws on everything else — including
// values people reasonably type by hand ("GMT-3", "BRT", "America/Sao Paulo"
// with a space). A misconfigured timezone should not take a page down, so
// fall back to UTC and say so once, somewhere findable in the logs.
function resolveTimeZone(): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: env.APP_TIMEZONE }).format(new Date());
    return env.APP_TIMEZONE;
  } catch {
    console.warn(
      `APP_TIMEZONE="${env.APP_TIMEZONE}" não é um fuso horário IANA válido ` +
        `(esperado algo como "America/Sao_Paulo"). Usando UTC.`,
    );
    return "UTC";
  }
}

const TIME_ZONE = resolveTimeZone();

// Assembled from explicit parts rather than by formatting with a locale that
// happens to print ISO ("en-CA"). A runtime built without that locale's data
// silently formats as "7/27/2026" instead, which then parses to an Invalid
// Date and turns every downstream date calculation into NaN.
export function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateKeyToDate(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data inválida: "${dateKey}" (esperado o formato YYYY-MM-DD).`);
  }
  return date;
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

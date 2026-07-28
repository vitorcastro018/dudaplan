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

// Deslocamento do fuso, em ms, no instante dado. Obtido formatando o instante
// no fuso e comparando com o mesmo relógio lido como UTC — não dá para assumir
// um valor fixo, porque o deslocamento muda com horário de verão.
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    // Um relógio de 24h formata a meia-noite como "24" em algumas plataformas.
    value("hour") % 24,
    value("minute"),
    value("second"),
  );

  return asUtc - date.getTime();
}

/**
 * Intervalo `[início, fim)` do dia local, em ISO UTC.
 *
 * Necessário porque `completed_at` é `timestamptz`. Comparar com uma string sem
 * fuso ("2026-07-28T00:00:00") faz o Postgres interpretá-la no fuso do servidor,
 * que no Supabase é UTC — em São Paulo isso desloca o corte em três horas e
 * tarefas concluídas no fim da noite caem no dia seguinte.
 */
export function dayRangeUtc(dateKey: string): { start: string; end: string } {
  const localMidnightAsUtc = dateKeyToDate(dateKey).getTime();

  // Duas passadas: a primeira usa o deslocamento no instante errado, a segunda
  // corrige usando o deslocamento no instante já aproximado.
  let start = new Date(localMidnightAsUtc - offsetMs(new Date(localMidnightAsUtc), TIME_ZONE));
  start = new Date(localMidnightAsUtc - offsetMs(start, TIME_ZONE));

  const nextMidnightAsUtc = dateKeyToDate(shiftDateKey(dateKey, 1)).getTime();
  let end = new Date(nextMidnightAsUtc - offsetMs(new Date(nextMidnightAsUtc), TIME_ZONE));
  end = new Date(nextMidnightAsUtc - offsetMs(end, TIME_ZONE));

  return { start: start.toISOString(), end: end.toISOString() };
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

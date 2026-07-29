/**
 * Datas civis ("AAAA-MM-DD") em horário local, para uso nos dois lados.
 *
 * Existe separado de `@/lib/date` porque aquele módulo importa `@/lib/env`, que
 * valida as variáveis do Supabase ao ser carregado. Puxar isso para dentro de um
 * Client Component quebraria o bundle do navegador, então o calendário e os
 * cálculos de duração moram aqui, sem nenhuma dependência.
 *
 * Tudo aqui é **local**, e não UTC como em `dateKeyToDate`. Um seletor de
 * calendário fala de dias no calendário de quem está olhando, não de instantes:
 * interpretar "2026-07-29" como meia-noite UTC e renderizar no fuso do navegador
 * exibe o dia 28 para qualquer fuso a oeste de Greenwich — o clássico erro de um
 * dia em date picker. As duas funções abaixo nunca saem do horário local, então
 * o dia que você clica é o dia que é gravado.
 */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value);
}

/** "2026-07-29" -> Date na meia-noite **local** daquele dia. */
export function parseDateKeyLocal(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Date -> "AAAA-MM-DD" lendo os campos **locais**, nunca `toISOString()`. */
export function toDateKeyLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKeyLocal(): string {
  return toDateKeyLocal(new Date());
}

/**
 * Dias inteiros de `from` até `to`, pela data civil.
 *
 * Conta em dias de calendário e não em milissegundos divididos por 86.400.000:
 * num dia de mudança de horário de verão o intervalo tem 23 ou 25 horas, e a
 * divisão devolveria 0,96 ou 1,04 dia, que arredonda errado.
 */
export function daysBetween(from: string, to: string): number {
  const start = parseDateKeyLocal(from);
  const end = parseDateKeyLocal(to);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

/** "29 de jul. de 2026" — rótulo curto para o gatilho do calendário. */
export function formatDateKeyShort(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateKeyLocal(dateKey));
}

/** Duração em dias, já escrita para caber ao lado do campo. */
export function formatDuration(days: number): string {
  if (days === 0) return "mesmo dia";
  if (days === 1) return "1 dia";
  if (days === -1) return "1 dia antes do início";
  if (days < 0) return `${Math.abs(days)} dias antes do início`;
  return `${days} dias`;
}

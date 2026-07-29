import type { RoutineShift, RoutineCadence } from "@/lib/supabase/types";

/**
 * Os turnos na ordem em que o dia acontece — é essa a ordem das seções da tela.
 *
 * Um módulo sem "use client", como `features/projects/deadlines.ts`, porque o
 * formulário (cliente) e a lista agrupada precisam dos mesmos rótulos.
 */
export const ROUTINE_SHIFTS = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "night", label: "Noite" },
] as const satisfies readonly { value: RoutineShift; label: string }[];

export const ROUTINE_SHIFT_LABEL: Record<RoutineShift, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
};

/** Rotina sem turno cai aqui, no fim da lista. */
export const NO_SHIFT_LABEL = "Sem turno";

/**
 * As cadências oferecidas no formulário.
 *
 * `weekly` fica de fora de propósito, embora exista no CHECK do banco: sem
 * `active_days` preenchido ela é indistinguível de `daily` para o filtro em
 * `getRoutineBoard`, ou seja, "semanal" hoje significa "todo dia". Quem quer um
 * recorte semanal escolhe "Personalizada" e marca os dias, que é o que o filtro
 * sabe respeitar. Linha antiga gravada como `weekly` abre no formulário como
 * personalizada.
 */
export const ROUTINE_CADENCES = [
  { value: "daily", label: "Todo dia" },
  { value: "weekdays", label: "Dias úteis" },
  { value: "custom", label: "Personalizada" },
] as const satisfies readonly { value: RoutineCadence; label: string }[];

/** 0 = domingo, como em `routines.active_days`. */
export const WEEKDAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
] as const;

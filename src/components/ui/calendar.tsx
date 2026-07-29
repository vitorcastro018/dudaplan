"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateKeyLocal, toDateKeyLocal, todayKeyLocal } from "@/lib/date-keys";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Grade de um mês, sempre com 6 semanas.
 *
 * As 42 células são fixas de propósito: um mês que ocupa 5 semanas e outro que
 * ocupa 6 mudariam a altura do popover ao navegar, e o calendário "pularia"
 * embaixo do cursor entre um mês e outro.
 */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export function Calendar({
  value,
  onSelect,
  className,
}: {
  /** Dia selecionado, em "AAAA-MM-DD", ou null. */
  value: string | null;
  onSelect: (dateKey: string) => void;
  className?: string;
}) {
  const today = todayKeyLocal();

  // O mês visível parte da seleção; sem seleção, do mês corrente. `useState` e
  // não derivado do `value`: depois de abrir, navegar para outro mês é estado
  // da navegação, e recalcular a partir do valor jogaria a pessoa de volta para
  // o mês da data escolhida a cada render.
  const [cursor, setCursor] = React.useState(() => {
    const base = value ? parseDateKeyLocal(value) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const days = React.useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const shifted = new Date(current.year, current.month + delta, 1);
      return { year: shifted.getFullYear(), month: shifted.getMonth() };
    });
  }

  return (
    <div className={cn("w-[268px] p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <MonthButton label="Mês anterior" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </MonthButton>

        <span aria-live="polite" className="text-ink text-sm font-medium">
          {MONTHS[cursor.month]} de {cursor.year}
        </span>

        <MonthButton label="Próximo mês" onClick={() => shiftMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </MonthButton>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((weekday, index) => (
          <span
            key={`${weekday}-${index}`}
            aria-hidden
            className="text-ink-muted flex h-7 items-center justify-center text-[11px] font-medium"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const dateKey = toDateKeyLocal(day);
          const isCurrentMonth = day.getMonth() === cursor.month;
          const isSelected = dateKey === value;
          const isToday = dateKey === today;

          return (
            <button
              key={dateKey}
              type="button"
              // `aria-pressed` e não `aria-selected`: fora de um grid/listbox
              // com papéis completos, `aria-selected` num botão solto não é
              // anunciado por leitor de tela.
              aria-pressed={isSelected}
              onClick={() => onSelect(dateKey)}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-sm tabular-nums transition-colors",
                "focus-visible:ring-accent focus-visible:ring-offset-surface focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
                isCurrentMonth ? "text-ink" : "text-ink-muted/50",
                !isSelected && "hover:bg-paper-sunk",
                isSelected && "bg-accent font-medium text-white",
                isToday && !isSelected && "ring-line-strong ring-1",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="text-ink-muted hover:bg-paper-sunk hover:text-ink focus-visible:ring-accent rounded-[var(--radius-sm)] p-1 focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

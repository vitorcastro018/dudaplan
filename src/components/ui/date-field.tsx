"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { daysBetween, formatDateKeyShort, formatDuration, isDateKey } from "@/lib/date-keys";

interface DateFieldProps {
  name: string;
  label: string;
  value: string | null;
  onChange: (dateKey: string) => void;
  /**
   * Data a partir da qual a duração é contada. Quando ausente, o campo não
   * mostra duração nenhuma — melhor omitir que exibir um número contado de uma
   * base que a pessoa não escolheu.
   */
  baseline?: string | null;
  hint?: string;
  error?: string | null;
  required?: boolean;
}

/**
 * Campo de data que abre um calendário.
 *
 * O calendário abre **embutido**, empurrando o conteúdo, em vez de flutuar por
 * cima. O formulário de projeto vive dentro de um `<dialog>`, e um popover
 * absoluto ali é recortado assim que o diálogo precisa de rolagem — o problema
 * clássico de `overflow` com camada flutuante. Embutido não tem esse conflito e
 * ainda funciona melhor no celular.
 *
 * O valor viaja num `input type="hidden"`, e não num `type="date"`: o campo
 * nativo traz o seu próprio seletor, que apareceria junto com este e daria dois
 * calendários no mesmo campo.
 */
export function DateField({
  name,
  label,
  value,
  onChange,
  baseline,
  hint,
  error,
  required,
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const fieldId = React.useId();

  const duration =
    isDateKey(baseline) && isDateKey(value) ? daysBetween(baseline, value) : null;

  return (
    <div>
      <Label htmlFor={fieldId}>
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </Label>

      <input type="hidden" name={name} value={value ?? ""} />

      <button
        id={fieldId}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          "border-line-strong bg-surface text-ink flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] border px-3 text-left text-sm",
          "focus-visible:ring-accent focus-visible:ring-offset-paper focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          error && "border-danger",
        )}
      >
        <CalendarDays className="text-ink-muted h-4 w-4 shrink-0" />
        <span className={cn("flex-1 truncate", !value && "text-ink-muted")}>
          {value ? formatDateKeyShort(value) : "Escolher data"}
        </span>
        {duration !== null && (
          <span
            className={cn(
              "shrink-0 font-mono text-xs tabular-nums",
              duration < 0 ? "text-danger" : "text-ink-muted",
            )}
          >
            {formatDuration(duration)}
          </span>
        )}
      </button>

      {open && (
        <div className="border-line bg-surface mt-2 rounded-[var(--radius)] border shadow-[var(--shadow-pop)]">
          <Calendar
            value={value}
            onSelect={(dateKey) => {
              onChange(dateKey);
              setOpen(false);
            }}
          />
        </div>
      )}

      {error ? (
        <p className="text-danger mt-1.5 text-xs">{error}</p>
      ) : (
        hint && <p className="text-ink-muted mt-1.5 text-xs">{hint}</p>
      )}
    </div>
  );
}

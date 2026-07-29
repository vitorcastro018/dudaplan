"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createRoutine, updateRoutine } from "@/lib/actions/routines";
import { ROUTINE_CADENCES, ROUTINE_SHIFTS, WEEKDAYS } from "@/features/routines/shifts";
import type { RoutineListItem } from "@/lib/data/routines";
import type { RoutineShift } from "@/lib/supabase/types";

/** `weekly` não é oferecida no formulário — ver o comentário em `shifts.ts`. */
type FormCadence = "daily" | "weekdays" | "custom";

function initialCadence(routine?: RoutineListItem): FormCadence {
  if (!routine) return "daily";
  return routine.cadence === "daily" || routine.cadence === "weekdays" ? routine.cadence : "custom";
}

export function RoutineFormDialog({
  routine,
  open,
  onClose,
}: {
  /** Ausente = criar. */
  routine?: RoutineListItem;
  open: boolean;
  onClose: () => void;
}) {
  const editing = routine !== undefined;
  const [pending, startTransition] = React.useTransition();
  const [cadence, setCadence] = React.useState<FormCadence>(initialCadence(routine));
  const [days, setDays] = React.useState<number[]>(routine?.active_days ?? []);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort(),
    );
  }

  function handleSubmit(formData: FormData) {
    if (cadence === "custom" && days.length === 0) {
      toast.error("Escolha pelo menos um dia da semana.");
      return;
    }

    startTransition(async () => {
      if (editing) {
        const value = (key: string) => String(formData.get(key) ?? "").trim();
        const result = await updateRoutine(routine.id, {
          name: value("name"),
          description: value("description") || null,
          cadence,
          activeDays: days,
          shift: (value("shift") || null) as RoutineShift | null,
          link: value("link") || null,
        });

        if (result.ok) {
          onClose();
          toast.success("Rotina atualizada.");
        } else {
          toast.error(result.error);
        }
        return;
      }

      const result = await createRoutine(formData);
      if (result.ok) {
        onClose();
        toast.success("Rotina criada.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Editar rotina" : "Nova rotina"}
      className="max-h-[85dvh] overflow-y-auto"
    >
      <form action={handleSubmit} className="flex flex-col gap-4">
        {/* No modo criar a action lê `cadence` e `activeDays` do FormData; os
            controles são de estado, então viajam em campo escondido. */}
        <input type="hidden" name="cadence" value={cadence} />
        {cadence === "custom" &&
          days.map((day) => <input key={day} type="hidden" name="activeDays" value={day} />)}

        <div>
          <Label htmlFor="routine-name">
            Nome<span className="text-danger ml-0.5">*</span>
          </Label>
          <Input
            id="routine-name"
            name="name"
            defaultValue={routine?.name}
            required
            maxLength={200}
            autoFocus
            placeholder="Revisar a caixa de entrada"
          />
        </div>

        <div>
          <Label htmlFor="routine-description">Descrição</Label>
          <Textarea
            id="routine-description"
            name="description"
            defaultValue={routine?.description ?? ""}
            maxLength={500}
            rows={2}
            placeholder="O que exatamente essa rotina envolve?"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="routine-shift">Turno</Label>
            <Select id="routine-shift" name="shift" defaultValue={routine?.shift ?? ""}>
              <option value="">Sem turno</option>
              {ROUTINE_SHIFTS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="routine-cadence">Frequência</Label>
            <Select
              id="routine-cadence"
              value={cadence}
              onChange={(event) => setCadence(event.target.value as FormCadence)}
            >
              {ROUTINE_CADENCES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {cadence === "custom" && (
          <div>
            <Label>
              Dias da semana<span className="text-danger ml-0.5">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(({ value, label }) => {
                const active = days.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    aria-pressed={active}
                    className={cn(
                      "h-8 rounded-[var(--radius-sm)] border px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-line-strong bg-surface text-ink-2 hover:bg-paper-sunk",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="routine-link">Link</Label>
          <Input
            id="routine-link"
            name="link"
            type="text"
            defaultValue={routine?.link ?? ""}
            maxLength={2000}
            placeholder="notion.so/minha-pauta"
          />
          <p className="text-ink-muted mt-1.5 text-xs">
            O endereço que a rotina abre. Sem http:// na frente, entra como https://.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : editing ? "Salvar" : "Criar rotina"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

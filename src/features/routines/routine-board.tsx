"use client";

import * as React from "react";
import { toast } from "sonner";
import { Archive, ExternalLink, Pencil, Plus } from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, SectionLabel } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { archiveRoutine, toggleRoutine } from "@/lib/actions/routines";
import { RoutineFormDialog } from "@/features/routines/routine-form-dialog";
import { NO_SHIFT_LABEL, ROUTINE_SHIFTS } from "@/features/routines/shifts";
import type { RoutineBoard as RoutineBoardData, RoutineListItem } from "@/lib/data/routines";

/** Manhã, Tarde, Noite e, por último, o que não tem turno. */
const GROUPS = [
  ...ROUTINE_SHIFTS.map(({ value, label }) => ({ key: value as string, label })),
  { key: "none", label: NO_SHIFT_LABEL },
];

export function RoutineBoard({ board }: { board: RoutineBoardData }) {
  const [pending, startTransition] = React.useTransition();
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  // Pelo id, não pela linha: depois de salvar o `revalidatePath` devolve uma
  // rotina nova, e guardar o objeto deixaria o diálogo na versão anterior.
  const editing = board.routines.find((routine) => routine.id === editingId) ?? null;
  const archiving = board.routines.find((routine) => routine.id === archivingId) ?? null;

  const doneCount = board.routines.filter((routine) => routine.done).length;

  const grouped = React.useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        routines: board.routines.filter((routine) => (routine.shift ?? "none") === group.key),
      })).filter((group) => group.routines.length > 0),
    [board.routines],
  );

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-muted font-mono text-xs tabular-nums">
          {doneCount} de {board.routines.length} concluídas
        </p>
        <Button onClick={() => setCreating(true)} disabled={pending}>
          <Plus className="h-4 w-4" />
          Nova rotina
        </Button>
      </div>

      {board.routines.length === 0 ? (
        <EmptyState
          title="Nenhuma rotina hoje"
          description="Crie as rotinas que você quer manter, com turno e link se fizer sentido."
        />
      ) : (
        <div className="flex flex-col gap-7">
          {grouped.map((group) => (
            <section key={group.key}>
              <SectionLabel>{group.label}</SectionLabel>
              <div className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
                {group.routines.map((routine) => (
                  <RoutineRow
                    key={routine.id}
                    routine={routine}
                    onToggle={(done) => run(() => toggleRoutine(routine.id, done, board.date))}
                    onEdit={() => setEditingId(routine.id)}
                    onArchive={() => setArchivingId(routine.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Montado só enquanto aberto: o formulário guarda cadência e dias em
          estado, e remontar é o que garante que ele reabra limpo. */}
      {creating && <RoutineFormDialog open onClose={() => setCreating(false)} />}

      {editing && (
        <RoutineFormDialog
          key={editing.id}
          routine={editing}
          open
          onClose={() => setEditingId(null)}
        />
      )}

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchivingId(null)}
        onConfirm={() => {
          if (archiving) run(() => archiveRoutine(archiving.id));
        }}
        title="Arquivar rotina"
        description={
          archiving
            ? `"${archiving.name}" sai da lista. O histórico de dias marcados continua no banco.`
            : undefined
        }
        confirmLabel="Arquivar"
      />
    </div>
  );
}

function RoutineRow({
  routine,
  onToggle,
  onEdit,
  onArchive,
}: {
  routine: RoutineListItem;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <CheckSquare
        checked={routine.done}
        onChange={onToggle}
        aria-label={routine.done ? `Desmarcar ${routine.name}` : `Marcar ${routine.name}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-ink truncate text-sm",
              routine.done && "text-ink-muted line-through",
            )}
          >
            {routine.name}
          </p>
          {routine.link && (
            // `rel="noopener noreferrer"` junto com `target="_blank"`: sem ele a
            // página aberta recebe `window.opener` e pode redirecionar esta aba.
            // O esquema já foi restrito a http/https na validação da action.
            <a
              href={routine.link}
              target="_blank"
              rel="noopener noreferrer"
              title={routine.link}
              aria-label={`Abrir link de ${routine.name}`}
              className="text-accent hover:text-accent-hover shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {routine.description && (
          <p className="text-ink-muted truncate text-xs">{routine.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          aria-label={`Editar ${routine.name}`}
          className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1.5"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onArchive}
          title="Arquivar"
          aria-label={`Arquivar ${routine.name}`}
          className="text-ink-muted hover:bg-paper-sunk hover:text-danger rounded-[var(--radius-sm)] p-1.5"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

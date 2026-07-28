"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { createRoutine, toggleRoutine } from "@/lib/actions/routines";
import type { RoutineBoard as RoutineBoardData } from "@/lib/data/routines";

export function RoutineBoard({ board }: { board: RoutineBoardData }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();

  const doneCount = board.routines.filter((routine) => routine.done).length;

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createRoutine(formData);
      if (result.ok) formRef.current?.reset();
      else toast.error(result.error);
    });
  }

  function handleToggle(routineId: string, done: boolean) {
    startTransition(async () => {
      const result = await toggleRoutine(routineId, done, board.date);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={handleCreate} className="flex gap-2">
        <Input name="name" placeholder="Nova rotina diária" required maxLength={200} className="flex-1" />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </form>

      {board.routines.length === 0 ? (
        <EmptyState
          title="Nenhuma rotina ainda"
          description="Crie as rotinas que você quer manter todo dia."
        />
      ) : (
        <>
          <p className="text-ink-muted font-mono text-xs tabular-nums">
            {doneCount} de {board.routines.length} concluídas
          </p>

          <div className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
            {board.routines.map((routine) => (
              <div key={routine.id} className="flex items-center gap-3 px-4 py-3">
                <CheckSquare
                  checked={routine.done}
                  onChange={(checked) => handleToggle(routine.id, checked)}
                  aria-label={
                    routine.done ? `Desmarcar ${routine.name}` : `Marcar ${routine.name}`
                  }
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-ink truncate text-sm",
                      routine.done && "text-ink-muted line-through",
                    )}
                  >
                    {routine.name}
                  </p>
                  {routine.description && (
                    <p className="text-ink-muted truncate text-xs">{routine.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

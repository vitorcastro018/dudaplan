"use client";

import * as React from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { todayKey, shiftDateKey, formatDateKeyLabel } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DailyCheckWithStatus } from "@/lib/data/daily-checks";
import { CheckRow } from "./check-row";
import { CheckFormDialog, type CheckFormValues } from "./check-form-dialog";

interface ChecksResponse {
  date: string;
  checks: DailyCheckWithStatus[];
}

export function ChecksBoard({
  initialDate,
  initialChecks,
}: {
  initialDate: string;
  initialChecks: DailyCheckWithStatus[];
}) {
  const [date, setDate] = React.useState(initialDate);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DailyCheckWithStatus | null>(null);

  const { data, mutate, isLoading } = useSWR<ChecksResponse>(
    `/api/daily-checks?date=${date}`,
    fetcher,
    date === initialDate ? { fallbackData: { date: initialDate, checks: initialChecks } } : {},
  );

  const checks = data?.checks ?? [];
  const isToday = date === todayKey();

  async function handleToggle(check: DailyCheckWithStatus) {
    const next = !check.isDone;
    await mutate(
      async (current) => {
        if (!current) return current;
        try {
          await apiRequest(`/api/daily-checks/${check.id}/toggle`, "POST", { date, done: next });
        } catch {
          toast.error("Não foi possível atualizar o check.");
        }
        return current;
      },
      {
        optimisticData: (current) =>
          current
            ? {
                ...current,
                checks: current.checks.map((c) =>
                  c.id === check.id
                    ? {
                        ...c,
                        isDone: next,
                        streak: next ? c.streak + 1 : Math.max(0, c.streak - 1),
                      }
                    : c,
                ),
              }
            : { date, checks: [] },
        rollbackOnError: true,
        populateCache: true,
        revalidate: true,
      },
    );
  }

  async function handleSubmit(values: CheckFormValues) {
    if (editing) {
      await apiRequest(`/api/daily-checks/${editing.id}`, "PATCH", values);
      toast.success("Check atualizado.");
    } else {
      await apiRequest("/api/daily-checks", "POST", values);
      toast.success("Check criado.");
    }
    setEditing(null);
    mutate();
  }

  async function handleArchive(check: DailyCheckWithStatus) {
    await apiRequest(`/api/daily-checks/${check.id}`, "PATCH", { isArchived: true });
    toast.success("Check arquivado.");
    mutate();
  }

  async function handleDelete(check: DailyCheckWithStatus) {
    await apiRequest(`/api/daily-checks/${check.id}`, "DELETE");
    toast.success("Check removido.");
    mutate();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDate((d) => shiftDateKey(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-2">
            <CalendarDays className="text-ink-muted h-4 w-4" />
            <span className="text-ink text-sm font-medium capitalize">
              {isToday ? "Hoje" : formatDateKeyLabel(date)}
            </span>
            <span className="text-ink-muted font-mono text-xs">{date}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDate((d) => shiftDateKey(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(todayKey())}>
              Hoje
            </Button>
          )}
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Novo check
        </Button>
      </div>

      {!isLoading && checks.length === 0 && (
        <EmptyState
          title="Nenhum check para este dia"
          description="Crie um check diário para acompanhar tarefas recorrentes."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo check
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {checks.map((check) => (
          <CheckRow
            key={check.id}
            check={check}
            onToggle={() => handleToggle(check)}
            onEdit={() => {
              setEditing(check);
              setDialogOpen(true);
            }}
            onArchive={() => handleArchive(check)}
            onDelete={() => handleDelete(check)}
          />
        ))}
      </div>

      <CheckFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editing}
      />
    </div>
  );
}

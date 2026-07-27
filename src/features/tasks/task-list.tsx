"use client";

import * as React from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash2, Sparkles, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { STATUS_LABELS, STATUS_ORDER, PRIORITY_LABELS, PRIORITY_TONE } from "./labels";
import { TaskFormDialog, type TaskFormValues } from "./task-form-dialog";

interface ProjectTaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  origin: string;
}

export function TaskList({
  projectId,
  initialTasks,
}: {
  projectId: string;
  initialTasks: ProjectTaskItem[];
}) {
  const { data: tasks, mutate } = useSWR<ProjectTaskItem[]>(
    `/api/projects/${projectId}/tasks`,
    fetcher,
    { fallbackData: initialTasks },
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectTaskItem | null>(null);
  const [deleting, setDeleting] = React.useState<ProjectTaskItem | null>(null);

  const list = tasks ?? [];

  async function handleSubmit(values: TaskFormValues) {
    if (editing) {
      await apiRequest(`/api/tasks/${editing.id}`, "PATCH", values);
      toast.success("Tarefa atualizada.");
    } else {
      await apiRequest(`/api/projects/${projectId}/tasks`, "POST", values);
      toast.success("Tarefa criada.");
    }
    setEditing(null);
    mutate();
  }

  async function handleStatusChange(task: ProjectTaskItem, status: string) {
    await mutate(
      async () => {
        await apiRequest(`/api/tasks/${task.id}`, "PATCH", { status });
        return undefined;
      },
      {
        optimisticData: (current) =>
          (current ?? []).map((t) => (t.id === task.id ? { ...t, status } : t)),
        rollbackOnError: true,
        populateCache: false,
        revalidate: true,
      },
    );
  }

  async function handleDelete() {
    if (!deleting) return;
    await apiRequest(`/api/tasks/${deleting.id}`, "DELETE");
    toast.success("Tarefa removida.");
    setDeleting(null);
    mutate();
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa ainda"
          description="Crie tarefas vinculadas a este projeto para acompanhar o progresso."
          action={<Button onClick={() => setDialogOpen(true)}>Nova tarefa</Button>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {STATUS_ORDER.map((status) => {
            const tasksInStatus = list.filter((task) => task.status === status);
            if (tasksInStatus.length === 0) return null;

            return (
              <div key={status}>
                <p className="section-label mb-2">
                  {STATUS_LABELS[status]} ({tasksInStatus.length})
                </p>
                <div className="flex flex-col gap-2">
                  {tasksInStatus.map((task) => (
                    <div
                      key={task.id}
                      className="group border-line bg-surface flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-ink flex items-center gap-1.5 truncate font-medium">
                          {task.origin === "MEETING_AI" && (
                            <Sparkles className="text-plum h-3.5 w-3.5 shrink-0" />
                          )}
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-ink-muted truncate text-sm">{task.description}</p>
                        )}
                      </div>

                      {task.dueDate && (
                        <span className="text-ink-muted shrink-0 font-mono text-xs">
                          {task.dueDate.slice(0, 10)}
                        </span>
                      )}

                      <Badge tone={PRIORITY_TONE[task.priority] ?? "neutral"}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>

                      <Select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                        className="h-8 w-auto shrink-0"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>

                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(task);
                            setDialogOpen(true);
                          }}
                          aria-label="Editar tarefa"
                          className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1.5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(task)}
                          aria-label="Excluir tarefa"
                          className="text-ink-muted hover:bg-danger-soft hover:text-danger rounded-[var(--radius-sm)] p-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Excluir tarefa?"
        description={`"${deleting?.title}" será removida permanentemente.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}

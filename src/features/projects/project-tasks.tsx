"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { createTask, setTaskDone } from "@/lib/actions/tasks";
import type { TaskListItem } from "@/lib/data/tasks";
import { TASK_STATUS_LABEL, TASK_STATUS_TONE } from "@/features/tasks/labels";
import { EditTaskDialog, type TaskProjectOption } from "@/features/tasks/edit-task-dialog";

export function ProjectTasks({
  projectId,
  tasks,
  projects,
}: {
  projectId: string;
  tasks: TaskListItem[];
  projects: TaskProjectOption[];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const editing = tasks.find((task) => task.id === editingId) ?? null;

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createTask(formData);
      if (result.ok) formRef.current?.reset();
      else toast.error(result.error);
    });
  }

  function handleToggle(taskId: string, done: boolean) {
    startTransition(async () => {
      const result = await setTaskDone(taskId, done);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-ink text-lg font-medium tracking-tight">Tarefas</h2>

      <form ref={formRef} action={handleCreate} className="flex gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <Input
          name="title"
          placeholder="Nova tarefa deste projeto"
          required
          maxLength={300}
          className="flex-1"
        />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState title="Sem tarefas" description="Adicione a primeira tarefa deste projeto." />
      ) : (
        <div className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
          {tasks.map((task) => {
            const done = task.status === "done";
            return (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                <CheckSquare
                  size="sm"
                  checked={done}
                  onChange={(checked) => handleToggle(task.id, checked)}
                  aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
                />
                <p
                  className={cn(
                    "text-ink min-w-0 flex-1 truncate text-sm",
                    done && "text-ink-muted line-through",
                  )}
                >
                  {task.title}
                </p>
                {task.scheduled_date && (
                  <span className="text-ink-muted font-mono text-xs tabular-nums">
                    {task.scheduled_date}
                  </span>
                )}
                <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
                <button
                  type="button"
                  aria-label={`Editar ${task.title}`}
                  onClick={() => setEditingId(task.id)}
                  className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1.5"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditTaskDialog
          key={editing.id}
          task={editing}
          projects={projects}
          open
          onClose={() => setEditingId(null)}
        />
      )}
    </section>
  );
}

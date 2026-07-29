"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { createTask, deleteTask, setTaskDone, updateTask } from "@/lib/actions/tasks";
import { NO_PROJECT } from "@/features/tasks/filters";
import type { TaskListItem } from "@/lib/data/tasks";
import type { TaskPriority } from "@/lib/supabase/types";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_STATUS_TONE } from "@/features/tasks/labels";
import { EditTaskDialog } from "@/features/tasks/edit-task-dialog";

interface ProjectOption {
  id: string;
  name: string;
}

const PRIORITIES = Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[];

export function TasksBoard({
  tasks,
  projects,
  activeFilter,
}: {
  tasks: TaskListItem[];
  projects: ProjectOption[];
  activeFilter: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const projectName = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  // Pelo id e não pela linha inteira: depois de salvar, o `revalidatePath`
  // devolve uma tarefa nova, e guardar o objeto deixaria o diálogo mostrando a
  // versão de antes da edição.
  const editing = tasks.find((task) => task.id === editingId) ?? null;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createTask(formData);
      if (result.ok) formRef.current?.reset();
      else toast.error(result.error);
    });
  }

  function handleFilter(value: string) {
    // `router.push` com o parâmetro na URL, e não estado local: assim o filtro
    // sobrevive a recarregar a página e pode ser compartilhado por link. A
    // consulta refeita no servidor também evita trazer tarefa que o filtro
    // esconderia de qualquer jeito.
    const query = value ? `?projeto=${encodeURIComponent(value)}` : "";
    router.push(`${pathname}${query}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        ref={formRef}
        action={handleCreate}
        className="border-line bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="title">Nova tarefa</Label>
            <Input
              id="title"
              name="title"
              placeholder="O que precisa ser feito?"
              required
              maxLength={300}
            />
          </div>

          <div className="sm:w-56">
            <Label htmlFor="projectId">Projeto</Label>
            <Select
              id="projectId"
              name="projectId"
              // Pré-seleciona o projeto do filtro: quem está olhando um projeto
              // quase sempre quer criar a tarefa dentro dele.
              defaultValue={activeFilter === NO_PROJECT ? "" : activeFilter}
            >
              <option value="">Sem projeto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:w-40">
            <Label htmlFor="scheduledDate">Para quando</Label>
            <Input id="scheduledDate" name="scheduledDate" type="date" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-3">
        <Label htmlFor="filtro" className="mb-0 shrink-0">
          Filtrar
        </Label>
        <Select
          id="filtro"
          value={activeFilter}
          onChange={(event) => handleFilter(event.target.value)}
          className="max-w-xs"
        >
          <option value="">Todos os projetos</option>
          <option value={NO_PROJECT}>Sem projeto</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <span className="text-ink-muted ml-auto font-mono text-xs tabular-nums">
          {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa aqui"
          description={
            activeFilter
              ? "Nenhuma tarefa neste recorte. Troque o filtro ou crie a primeira."
              : "Crie a primeira tarefa no campo acima."
          }
        />
      ) : (
        <div className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
          {tasks.map((task) => {
            const done = task.status === "done";

            return (
              <div key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <CheckSquare
                  size="sm"
                  checked={done}
                  onChange={(checked) => run(() => setTaskDone(task.id, checked))}
                  aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
                />

                <p
                  className={cn(
                    "text-ink min-w-[12rem] flex-1 truncate text-sm",
                    done && "text-ink-muted line-through",
                  )}
                  title={task.title}
                >
                  {task.title}
                </p>

                <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>

                {/* Os três controles abaixo salvam direto, sem abrir o modal:
                    são os campos que mais se mexem no dia a dia. O resto
                    (título, prazo, estimativa, motivo do bloqueio) fica no
                    diálogo, que é onde cabe. */}
                <Input
                  type="date"
                  aria-label={`Data de ${task.title}`}
                  value={task.scheduled_date ?? ""}
                  onChange={(event) =>
                    run(() => updateTask(task.id, { scheduledDate: event.target.value || null }))
                  }
                  className="h-8 w-[9.5rem] text-xs"
                />

                <Select
                  aria-label={`Prioridade de ${task.title}`}
                  value={task.priority}
                  onChange={(event) =>
                    run(() => updateTask(task.id, { priority: event.target.value as TaskPriority }))
                  }
                  className="h-8 w-full max-w-[7rem] text-xs sm:w-auto"
                >
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {TASK_PRIORITY_LABEL[value]}
                    </option>
                  ))}
                </Select>

                <Select
                  aria-label={`Projeto de ${task.title}`}
                  value={task.project_id ?? ""}
                  onChange={(event) =>
                    run(() => updateTask(task.id, { projectId: event.target.value || null }))
                  }
                  className="h-8 w-full max-w-[13rem] text-xs sm:w-auto"
                >
                  <option value="">Sem projeto</option>
                  {/* Um projeto arquivado não aparece na lista de opções, mas a
                      tarefa pode continuar apontando para ele. Sem esta opção
                      extra o `select` cairia em "Sem projeto" e o primeiro
                      clique em qualquer outro campo desanexaria a tarefa em
                      silêncio. */}
                  {task.project_id && !projectName.has(task.project_id) && (
                    <option value={task.project_id}>Projeto arquivado</option>
                  )}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>

                <button
                  type="button"
                  aria-label={`Editar ${task.title}`}
                  onClick={() => setEditingId(task.id)}
                  className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1.5"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  aria-label={`Excluir ${task.title}`}
                  onClick={() => run(() => deleteTask(task.id))}
                  className="text-ink-muted hover:bg-danger-soft hover:text-danger rounded-[var(--radius-sm)] p-1.5"
                >
                  <Trash2 className="h-4 w-4" />
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
    </div>
  );
}

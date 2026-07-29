"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { deleteTask, updateTask } from "@/lib/actions/tasks";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/features/tasks/labels";
import type { TaskListItem } from "@/lib/data/tasks";
import type { TaskEnergy, TaskPriority, TaskStatus } from "@/lib/supabase/types";

export interface TaskProjectOption {
  id: string;
  name: string;
}

const STATUSES = Object.keys(TASK_STATUS_LABEL) as TaskStatus[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[];

const ENERGY_LABEL: Record<TaskEnergy, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

/**
 * Edição completa de uma tarefa.
 *
 * Toda a validação de verdade está em `updateTaskSchema`, no servidor — aqui
 * só os campos. A exceção é o motivo do bloqueio: o CHECK
 * `tasks_waiting_needs_reason` recusa "aguardando" sem motivo, e é mais honesto
 * mostrar o campo na hora em que ele passa a ser obrigatório do que mandar o
 * formulário para receber de volta um erro que já se sabia de antemão.
 */
export function EditTaskDialog({
  task,
  projects,
  open,
  onClose,
}: {
  task: TaskListItem;
  projects: TaskProjectOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  function handleSubmit(formData: FormData) {
    const value = (key: string) => String(formData.get(key) ?? "").trim();

    const input = {
      title: value("title"),
      status,
      priority: value("priority") as TaskPriority,
      energy: value("energy") || null,
      projectId: value("projectId") || null,
      scheduledDate: value("scheduledDate") || null,
      dueDate: value("dueDate") || null,
      estimateMinutes: value("estimateMinutes") || null,
      blockedReason: value("blockedReason") || null,
    };

    if (status === "waiting" && !input.blockedReason) {
      toast.error("Para deixar a tarefa aguardando é preciso dizer o motivo.");
      return;
    }

    startTransition(async () => {
      const result = await updateTask(task.id, input);
      if (result.ok) {
        onClose();
        toast.success("Tarefa atualizada.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.ok) onClose();
      else toast.error(result.error);
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Editar tarefa"
        className="max-h-[85dvh] overflow-y-auto"
      >
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor={`title-${task.id}`}>
              Título<span className="text-danger ml-0.5">*</span>
            </Label>
            <Input
              id={`title-${task.id}`}
              name="title"
              defaultValue={task.title}
              required
              maxLength={300}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`status-${task.id}`}>Situação</Label>
              <Select
                id={`status-${task.id}`}
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {TASK_STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor={`priority-${task.id}`}>Prioridade</Label>
              <Select id={`priority-${task.id}`} name="priority" defaultValue={task.priority}>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {TASK_PRIORITY_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {status === "waiting" && (
            <div>
              <Label htmlFor={`blockedReason-${task.id}`}>
                Aguardando o quê?<span className="text-danger ml-0.5">*</span>
              </Label>
              <Textarea
                id={`blockedReason-${task.id}`}
                name="blockedReason"
                defaultValue={task.blocked_reason ?? ""}
                maxLength={500}
                rows={2}
                placeholder="Resposta de alguém, entrega de terceiro, decisão pendente..."
              />
              <p className="text-ink-muted mt-1.5 text-xs">
                Tarefa parada sem motivo registrado vira tarefa esquecida.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor={`projectId-${task.id}`}>Projeto</Label>
            <Select
              id={`projectId-${task.id}`}
              name="projectId"
              defaultValue={task.project_id ?? ""}
            >
              <option value="">Sem projeto</option>
              {/* Mesma razão do select da lista: projeto arquivado sai das
                  opções mas a tarefa continua apontando para ele, e sem esta
                  entrada o formulário desanexaria a tarefa em silêncio. */}
              {task.project_id && !projects.some((project) => project.id === task.project_id) && (
                <option value={task.project_id}>Projeto arquivado</option>
              )}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`scheduledDate-${task.id}`}>Para quando</Label>
              <Input
                id={`scheduledDate-${task.id}`}
                name="scheduledDate"
                type="date"
                defaultValue={task.scheduled_date ?? ""}
              />
            </div>

            <div>
              <Label htmlFor={`dueDate-${task.id}`}>Prazo</Label>
              <Input
                id={`dueDate-${task.id}`}
                name="dueDate"
                type="date"
                defaultValue={task.due_date ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`estimateMinutes-${task.id}`}>Estimativa (min)</Label>
              <Input
                id={`estimateMinutes-${task.id}`}
                name="estimateMinutes"
                type="number"
                min={1}
                step={5}
                defaultValue={task.estimate_minutes ?? ""}
              />
            </div>

            <div>
              <Label htmlFor={`energy-${task.id}`}>Energia</Label>
              <Select id={`energy-${task.id}`} name="energy" defaultValue={task.energy ?? ""}>
                <option value="">Não definida</option>
                {(Object.keys(ENERGY_LABEL) as TaskEnergy[]).map((value) => (
                  <option key={value} value={value}>
                    {ENERGY_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="border-line flex items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              Excluir
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir tarefa"
        description={`"${task.title}" será apagada definitivamente.`}
        confirmLabel="Excluir"
      />
    </>
  );
}

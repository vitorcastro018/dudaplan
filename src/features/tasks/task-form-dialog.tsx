"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, PRIORITY_LABELS } from "./labels";

export interface TaskFormValues {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

export interface TaskFormInitialValues extends TaskFormValues {
  id: string;
}

export function TaskFormDialog({
  open,
  onClose,
  onSubmit,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  initialValues: TaskFormInitialValues | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={initialValues ? "Editar tarefa" : "Nova tarefa"}>
      {open && (
        <TaskForm
          key={initialValues?.id ?? "new"}
          onClose={onClose}
          onSubmit={onSubmit}
          initialValues={initialValues}
        />
      )}
    </Dialog>
  );
}

function TaskForm({
  onClose,
  onSubmit,
  initialValues,
}: {
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  initialValues: TaskFormInitialValues | null;
}) {
  const [title, setTitle] = React.useState(initialValues?.title ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [status, setStatus] = React.useState(initialValues?.status ?? "TODO");
  const [priority, setPriority] = React.useState(initialValues?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = React.useState(initialValues?.dueDate ?? "");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title,
        description: description || null,
        status,
        priority,
        dueDate: dueDate || null,
      });
      onClose();
    } catch {
      toast.error("Não foi possível salvar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Prioridade</Label>
          <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="dueDate">Prazo</Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

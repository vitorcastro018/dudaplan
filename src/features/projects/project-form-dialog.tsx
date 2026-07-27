"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ProjectFormValues {
  name: string;
  description: string | null;
  colorToken: string;
  startDate: string | null;
  dueDate: string | null;
}

export interface ProjectFormInitialValues extends ProjectFormValues {
  id: string;
}

const COLOR_OPTIONS = [
  { value: "accent", label: "Terracota" },
  { value: "pine", label: "Verde" },
  { value: "ochre", label: "Ocre" },
  { value: "plum", label: "Ameixa" },
];

export function ProjectFormDialog({
  open,
  onClose,
  onSubmit,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  initialValues: ProjectFormInitialValues | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={initialValues ? "Editar projeto" : "Novo projeto"}>
      {open && (
        <ProjectForm
          key={initialValues?.id ?? "new"}
          onClose={onClose}
          onSubmit={onSubmit}
          initialValues={initialValues}
        />
      )}
    </Dialog>
  );
}

function ProjectForm({
  onClose,
  onSubmit,
  initialValues,
}: {
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  initialValues: ProjectFormInitialValues | null;
}) {
  const [name, setName] = React.useState(initialValues?.name ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [colorToken, setColorToken] = React.useState(initialValues?.colorToken ?? "accent");
  const [startDate, setStartDate] = React.useState(initialValues?.startDate ?? "");
  const [dueDate, setDueDate] = React.useState(initialValues?.dueDate ?? "");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name,
        description: description || null,
        colorToken,
        startDate: startDate || null,
        dueDate: dueDate || null,
      });
      onClose();
    } catch {
      toast.error("Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          <Label htmlFor="color">Cor</Label>
          <Select id="color" value={colorToken} onChange={(e) => setColorToken(e.target.value)}>
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="startDate">Início</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
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

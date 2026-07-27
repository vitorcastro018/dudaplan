"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/fetcher";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ProjectFormDialog, type ProjectFormValues } from "./project-form-dialog";
import { PROJECT_STATUS_LABELS } from "./status";

export interface ProjectHeaderData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  colorToken: string;
  startDate: string | null;
  dueDate: string | null;
}

export function ProjectHeaderActions({ project }: { project: ProjectHeaderData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  async function handleStatusChange(status: string) {
    await apiRequest(`/api/projects/${project.id}`, "PATCH", { status });
    toast.success("Status atualizado.");
    router.refresh();
  }

  async function handleEdit(values: ProjectFormValues) {
    const updated = await apiRequest<{ slug: string }>(
      `/api/projects/${project.id}`,
      "PATCH",
      values,
    );
    toast.success("Projeto atualizado.");
    if (updated.slug !== project.slug) {
      router.push(`/projetos/${updated.slug}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    await apiRequest(`/api/projects/${project.id}`, "DELETE");
    toast.success("Projeto removido.");
    router.push("/projetos");
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={project.status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="h-8 w-auto"
      >
        {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        aria-label="Editar projeto"
        className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-2"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        aria-label="Excluir projeto"
        className="text-ink-muted hover:bg-danger-soft hover:text-danger rounded-[var(--radius-sm)] p-2"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <ProjectFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        initialValues={{
          id: project.id,
          name: project.name,
          description: project.description,
          colorToken: project.colorToken,
          startDate: project.startDate,
          dueDate: project.dueDate,
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir projeto?"
        description={`"${project.name}" e todas as notas, tarefas e reuniões vinculadas serão removidos permanentemente.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}

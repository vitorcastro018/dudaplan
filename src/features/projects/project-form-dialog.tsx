"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { ProjectForm } from "@/features/projects/project-form";
import type { ProjectListItem } from "@/lib/data/projects";

/**
 * O formulário de projeto dentro de um diálogo próprio.
 *
 * O `key` remonta o `ProjectForm` a cada abertura: ele guarda início e prazos
 * em estado e os campos de texto são não-controlados, então sem isso um
 * formulário cancelado reabriria com o que tinha sido digitado antes.
 */
export function ProjectFormDialog({
  project,
  open,
  onClose,
}: {
  /** Ausente = criar. */
  project?: ProjectListItem;
  open: boolean;
  onClose: () => void;
}) {
  const editing = project !== undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Editar projeto" : "Novo projeto"}
      description={editing ? undefined : "Todos os campos são obrigatórios."}
      className="max-h-[85dvh] overflow-y-auto"
    >
      <ProjectForm project={project} onDone={onClose} onCancel={onClose} />
    </Dialog>
  );
}

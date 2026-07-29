"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { archiveProject } from "@/lib/actions/projects";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import type { ProjectListItem } from "@/lib/data/projects";

/**
 * Editar e arquivar, no cabeçalho da página do projeto.
 *
 * Não ficam no card de `/projetos` porque o card inteiro é um `<Link>`, e botão
 * dentro de link aninha elementos interativos — o clique fica ambíguo para
 * teclado e leitor de tela.
 */
export function ProjectActions({ project }: { project: ProjectListItem }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveProject(project.id);
      if (result.ok) {
        toast.success("Projeto arquivado.");
        // A página atual deixa de existir na lista; ficar nela mostraria um
        // projeto que a sidebar já não lista.
        router.push("/projetos");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setEditing(true)} disabled={pending}>
        <Pencil className="h-4 w-4" />
        Editar
      </Button>
      <Button variant="ghost" onClick={() => setConfirmArchive(true)} disabled={pending}>
        <Archive className="h-4 w-4" />
        Arquivar
      </Button>

      {/* Montado só enquanto aberto, para reabrir com os valores atuais do
          projeto em vez do que ficou de uma edição anterior. */}
      {editing && <ProjectFormDialog project={project} open onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={handleArchive}
        title="Arquivar projeto"
        description={`"${project.name}" sai das listas. As tarefas continuam existindo, sem projeto visível.`}
        confirmLabel="Arquivar"
      />
    </>
  );
}

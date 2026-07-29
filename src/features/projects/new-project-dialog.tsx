"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";

/** Botão "Novo projeto" do cabeçalho de `/projetos`. O formulário em si é o
 *  mesmo da edição — ver `project-form-dialog.tsx`. */
export function NewProjectDialog() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo projeto
      </Button>

      {/* Montado só enquanto aberto: o formulário guarda início e prazos em
          estado e os campos de texto são não-controlados, então remontar é o
          que garante que ele reabra limpo depois de um cancelamento. */}
      {open && <ProjectFormDialog open onClose={() => setOpen(false)} />}
    </>
  );
}

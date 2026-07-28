"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createProject } from "@/lib/actions/projects";

export function NewProjectDialog() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createProject(formData);
      if (result.ok) {
        setOpen(false);
        toast.success("Projeto criado.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo projeto
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Novo projeto">
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required maxLength={200} autoFocus />
          </div>

          <div>
            <Label htmlFor="outcome">Resultado esperado</Label>
            <Input
              id="outcome"
              name="outcome"
              required
              maxLength={500}
              placeholder="Como você saberá que terminou?"
            />
            <p className="text-ink-muted mt-1.5 text-xs">
              Obrigatório de propósito: projeto sem critério de conclusão não termina, só se
              arrasta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Início</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div>
              <Label htmlFor="dueDate">Prazo</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar projeto"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

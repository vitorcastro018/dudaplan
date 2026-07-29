"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { todayKeyLocal } from "@/lib/date-keys";
import { createProject } from "@/lib/actions/projects";
import { PROJECT_DEADLINES } from "@/features/projects/deadlines";

type DeadlineField = (typeof PROJECT_DEADLINES)[number]["field"];
type Deadlines = Record<DeadlineField, string | null>;

const EMPTY_DEADLINES: Deadlines = {
  deadlineOptimistic: null,
  deadlineMediocre: null,
  deadlineRealistic: null,
};

export function NewProjectDialog() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // O início entra preenchido com hoje. É a base de contagem dos três prazos,
  // então deixá-lo vazio faria o formulário abrir sem conseguir mostrar duração
  // nenhuma — justamente o número que estes campos existem para mostrar.
  const [startDate, setStartDate] = React.useState<string>(todayKeyLocal());
  const [deadlines, setDeadlines] = React.useState<Deadlines>(EMPTY_DEADLINES);
  const [errors, setErrors] = React.useState<Partial<Record<DeadlineField, string>>>({});

  function reset() {
    setStartDate(todayKeyLocal());
    setDeadlines(EMPTY_DEADLINES);
    setErrors({});
  }

  function handleSubmit(formData: FormData) {
    // Os prazos viajam em input escondido, e campo escondido fica de fora da
    // validação nativa do navegador — `required` num `type="hidden"` não é
    // checado. Daí a checagem explícita aqui, antes de gastar uma ida ao
    // servidor só para receber de volta "faltou o prazo".
    const missing = PROJECT_DEADLINES.filter(({ field }) => !deadlines[field]);

    if (missing.length > 0) {
      setErrors(
        Object.fromEntries(missing.map(({ field }) => [field, "Escolha uma data."])) as Partial<
          Record<DeadlineField, string>
        >,
      );
      toast.error("Os três prazos são obrigatórios.");
      return;
    }

    setErrors({});

    startTransition(async () => {
      const result = await createProject(formData);
      if (result.ok) {
        setOpen(false);
        reset();
        toast.success("Projeto criado.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function closeDialog() {
    setOpen(false);
    reset();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo projeto
      </Button>

      <Dialog
        open={open}
        onClose={closeDialog}
        title="Novo projeto"
        description="Todos os campos são obrigatórios."
        className="max-h-[85dvh] overflow-y-auto"
      >
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">
              Nome<span className="text-danger ml-0.5">*</span>
            </Label>
            <Input id="name" name="name" required maxLength={200} autoFocus />
          </div>

          <div>
            <Label htmlFor="problem">
              Problema a ser resolvido<span className="text-danger ml-0.5">*</span>
            </Label>
            <Textarea
              id="problem"
              name="problem"
              required
              maxLength={1000}
              rows={3}
              placeholder="Que dor este projeto existe para resolver?"
            />
            <p className="text-ink-muted mt-1.5 text-xs">
              Sem problema declarado não há como decidir depois se o projeto ainda vale a pena.
            </p>
          </div>

          <div>
            <Label htmlFor="outcome">
              Resultado esperado<span className="text-danger ml-0.5">*</span>
            </Label>
            <Textarea
              id="outcome"
              name="outcome"
              required
              maxLength={500}
              rows={2}
              placeholder="Como você saberá que terminou?"
            />
            <p className="text-ink-muted mt-1.5 text-xs">
              Projeto sem critério de conclusão não termina, só se arrasta.
            </p>
          </div>

          <div className="border-line border-t pt-4">
            <DateField
              name="startDate"
              label="Início"
              value={startDate}
              onChange={setStartDate}
              hint="Base de contagem dos prazos abaixo."
              required
            />
          </div>

          <div className="flex flex-col gap-4">
            {PROJECT_DEADLINES.map(({ field, label, hint }) => (
              <DateField
                key={field}
                name={field}
                label={label}
                hint={hint}
                required
                value={deadlines[field]}
                error={errors[field]}
                baseline={startDate}
                onChange={(dateKey) => {
                  setDeadlines((current) => ({ ...current, [field]: dateKey }));
                  setErrors((current) => ({ ...current, [field]: undefined }));
                }}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeDialog}>
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

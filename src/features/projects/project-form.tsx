"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { todayKeyLocal } from "@/lib/date-keys";
import { createProject, updateProject } from "@/lib/actions/projects";
import { PROJECT_DEADLINES } from "@/features/projects/deadlines";
import { PROJECT_STATUS_LABEL } from "@/features/projects/status";
import type { ProjectListItem } from "@/lib/data/projects";
import type { ProjectStatus } from "@/lib/supabase/types";

type DeadlineField = (typeof PROJECT_DEADLINES)[number]["field"];
type Deadlines = Record<DeadlineField, string | null>;

const STATUSES = Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[];

const EMPTY_DEADLINES: Deadlines = {
  deadlineOptimistic: null,
  deadlineMediocre: null,
  deadlineRealistic: null,
};

function deadlinesOf(project: ProjectListItem): Deadlines {
  return {
    deadlineOptimistic: project.deadline_optimistic,
    deadlineMediocre: project.deadline_mediocre,
    deadlineRealistic: project.deadline_realistic,
  };
}

/**
 * O formulário de projeto, sem o diálogo em volta.
 *
 * Separado do `ProjectFormDialog` porque a tela de reuniões precisa dele
 * **dentro** do diálogo de reunião, para criar um projeto sem sair do
 * formulário. Empilhar um `<dialog>` dentro do outro não serviria: o `Dialog`
 * fecha ao clique no backdrop comparando `e.target === ref.current`, e fechar o
 * de fora dispara o evento `close` nativo, que devolve o controle para quem
 * abriu — ou seja, o diálogo inteiro sumiria.
 *
 * Criar e editar compartilham o corpo porque a parte chata é a mesma: os três
 * prazos viajam em `input type="hidden"` (o `DateField` traz o próprio
 * calendário) e por isso ficam de fora da validação nativa do navegador.
 */
export function ProjectForm({
  project,
  onDone,
  onCancel,
  onCreated,
}: {
  /** Ausente = criar. */
  project?: ProjectListItem;
  onDone: () => void;
  onCancel: () => void;
  /** Chamado com o id do projeto recém-criado, no modo criar. */
  onCreated?: (projectId: string) => void;
}) {
  const editing = project !== undefined;
  const [pending, startTransition] = React.useTransition();

  // O início entra preenchido com hoje. É a base de contagem dos três prazos,
  // então deixá-lo vazio faria o formulário abrir sem conseguir mostrar duração
  // nenhuma — justamente o número que estes campos existem para mostrar.
  const [startDate, setStartDate] = React.useState<string>(project?.start_date ?? todayKeyLocal());
  const [deadlines, setDeadlines] = React.useState<Deadlines>(
    project ? deadlinesOf(project) : EMPTY_DEADLINES,
  );
  const [errors, setErrors] = React.useState<Partial<Record<DeadlineField, string>>>({});

  function handleSubmit(formData: FormData) {
    // Campo escondido fica de fora da validação nativa do navegador —
    // `required` num `type="hidden"` não é checado. Daí a checagem explícita
    // aqui, antes de gastar uma ida ao servidor só para receber de volta
    // "faltou o prazo".
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
      if (editing) {
        const value = (key: string) => String(formData.get(key) ?? "").trim();
        const result = await updateProject(project.id, {
          name: value("name"),
          problem: value("problem"),
          outcome: value("outcome"),
          status: value("status") as ProjectStatus,
          startDate: value("startDate") || null,
          deadlineOptimistic: value("deadlineOptimistic"),
          deadlineMediocre: value("deadlineMediocre"),
          deadlineRealistic: value("deadlineRealistic"),
        });

        if (result.ok) {
          onDone();
          toast.success("Projeto atualizado.");
        } else {
          toast.error(result.error);
        }
        return;
      }

      const result = await createProject(formData);
      if (result.ok) {
        toast.success("Projeto criado.");
        onCreated?.(result.id);
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="project-name">
          Nome<span className="text-danger ml-0.5">*</span>
        </Label>
        <Input
          id="project-name"
          name="name"
          defaultValue={project?.name}
          required
          maxLength={200}
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="project-problem">
          Problema a ser resolvido<span className="text-danger ml-0.5">*</span>
        </Label>
        <Textarea
          id="project-problem"
          name="problem"
          defaultValue={project?.problem}
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
        <Label htmlFor="project-outcome">
          Resultado esperado<span className="text-danger ml-0.5">*</span>
        </Label>
        <Textarea
          id="project-outcome"
          name="outcome"
          defaultValue={project?.outcome}
          required
          maxLength={500}
          rows={2}
          placeholder="Como você saberá que terminou?"
        />
        <p className="text-ink-muted mt-1.5 text-xs">
          Projeto sem critério de conclusão não termina, só se arrasta.
        </p>
      </div>

      <div>
        <Label htmlFor="project-status">Situação</Label>
        <Select id="project-status" name="status" defaultValue={project?.status ?? "active"}>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
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
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : editing ? "Salvar" : "Criar projeto"}
        </Button>
      </div>
    </form>
  );
}

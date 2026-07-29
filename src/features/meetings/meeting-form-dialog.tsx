"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { createMeeting, updateMeeting } from "@/lib/actions/meetings";
import { ProjectForm } from "@/features/projects/project-form";
import type { MeetingDetail } from "@/lib/data/meetings";

export interface MeetingProjectOption {
  id: string;
  name: string;
}

/** Valor sentinela do `<select>` que abre o formulário de projeto. Não é um
 *  uuid, então nunca colide com o id de um projeto real. */
const NEW_PROJECT = "__novo__";

export function MeetingFormDialog({
  meeting,
  projects,
  open,
  onClose,
  /** Data/hora local sugerida ao criar ("AAAA-MM-DDTHH:MM"). */
  defaultScheduledAt,
}: {
  /** Ausente = criar. */
  meeting?: MeetingDetail;
  projects: MeetingProjectOption[];
  open: boolean;
  onClose: () => void;
  defaultScheduledAt?: string;
}) {
  const editing = meeting !== undefined;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [projectId, setProjectId] = React.useState<string>(meeting?.project_id ?? "");
  const [newProjectName, setNewProjectName] = React.useState<string | null>(null);
  const [creatingProject, setCreatingProject] = React.useState(false);

  function handleProjectChange(value: string) {
    // O formulário de projeto **substitui o corpo deste diálogo** em vez de
    // abrir outro `<dialog>` por cima. Fechar o de fora dispararia o evento
    // `close` nativo, que o `Dialog` repassa para `onClose` — e o diálogo da
    // reunião inteiro sumiria junto com o que já estava digitado.
    if (value === NEW_PROJECT) setCreatingProject(true);
    else setProjectId(value);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (editing) {
        const value = (key: string) => String(formData.get(key) ?? "").trim();
        const result = await updateMeeting(meeting.id, {
          title: value("title"),
          scheduledAt: value("scheduledAt") || null,
          projectId: value("projectId") || null,
          notes: value("notes") || null,
          participants: String(formData.get("participants") ?? ""),
        });

        if (result.ok) {
          onClose();
          toast.success("Reunião atualizada.");
        } else {
          toast.error(result.error);
        }
        return;
      }

      const result = await createMeeting(formData);
      if (result.ok) {
        onClose();
        toast.success("Reunião criada.");
        router.push(`/reunioes/${result.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const participantsDefault = meeting?.participants
    .map((participant) => participant.external_name ?? "")
    .filter(Boolean)
    .join("\n");

  // O projeto recém-criado ainda não está em `projects`: a lista vem do
  // servidor e só chega atualizada no próximo render. Sem esta entrada extra o
  // `<select>` cairia em "Sem projeto" e a escolha se perderia em silêncio.
  const selectedIsKnown = !projectId || projects.some((project) => project.id === projectId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={creatingProject ? "Novo projeto" : editing ? "Editar reunião" : "Nova reunião"}
      description={
        creatingProject ? "O projeto criado aqui já entra selecionado na reunião." : undefined
      }
      className="max-h-[85dvh] overflow-y-auto"
    >
      {/* O formulário da reunião fica montado o tempo todo, apenas escondido
          enquanto o de projeto está na frente: os campos são não-controlados, e
          desmontá-los apagaria título, participantes e anotações já digitados —
          exatamente o que quem clica em "criar novo projeto" não espera perder.
          Os dois `<form>` são irmãos, nunca aninhados. */}
      <div hidden={creatingProject}>
        <MeetingFields
          meeting={meeting}
          editing={editing}
          projects={projects}
          projectId={projectId}
          selectedIsKnown={selectedIsKnown}
          newProjectName={newProjectName}
          participantsDefault={participantsDefault}
          defaultScheduledAt={defaultScheduledAt}
          pending={pending}
          onProjectChange={handleProjectChange}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </div>

      {creatingProject && (
        <ProjectForm
          onCancel={() => setCreatingProject(false)}
          onDone={() => setCreatingProject(false)}
          onCreated={(newProjectId) => {
            setProjectId(newProjectId);
            setNewProjectName("Projeto recém-criado");
          }}
        />
      )}
    </Dialog>
  );
}

function MeetingFields({
  meeting,
  editing,
  projects,
  projectId,
  selectedIsKnown,
  newProjectName,
  participantsDefault,
  defaultScheduledAt,
  pending,
  onProjectChange,
  onSubmit,
  onCancel,
}: {
  meeting?: MeetingDetail;
  editing: boolean;
  projects: MeetingProjectOption[];
  projectId: string;
  selectedIsKnown: boolean;
  newProjectName: string | null;
  participantsDefault?: string;
  defaultScheduledAt?: string;
  pending: boolean;
  onProjectChange: (value: string) => void;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <Label htmlFor="meeting-title">
          Título da reunião<span className="text-danger ml-0.5">*</span>
        </Label>
        <Input
          id="meeting-title"
          name="title"
          defaultValue={meeting?.title}
          required
          maxLength={300}
          autoFocus
          placeholder="Alinhamento semanal"
        />
      </div>

      <div>
        <Label htmlFor="meeting-scheduledAt">Data e hora</Label>
        <Input
          id="meeting-scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          defaultValue={defaultScheduledAt ?? ""}
        />
      </div>

      <div>
        <Label htmlFor="meeting-project">Projeto</Label>
        <Select
          id="meeting-project"
          value={projectId}
          onChange={(event) => onProjectChange(event.target.value)}
        >
          <option value="">Sem projeto</option>
          {!selectedIsKnown && (
            <option value={projectId}>{newProjectName ?? "Projeto arquivado"}</option>
          )}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
          <option value={NEW_PROJECT}>+ Criar novo projeto</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="meeting-participants">Participantes</Label>
        <Textarea
          id="meeting-participants"
          name="participants"
          defaultValue={participantsDefault}
          rows={3}
          maxLength={5000}
          placeholder={"Duda\nConvidado externo"}
        />
        <p className="text-ink-muted mt-1.5 text-xs">Um nome por linha.</p>
      </div>

      <div>
        <Label htmlFor="meeting-notes">Anotações</Label>
        <Textarea
          id="meeting-notes"
          name="notes"
          defaultValue={meeting?.notes ?? ""}
          rows={6}
          maxLength={20000}
          placeholder="O que foi discutido, o que ficou decidido, o que ficou pendente..."
        />
        <p className="text-ink-muted mt-1.5 text-xs">
          Aceita Markdown — listas, negrito e títulos aparecem formatados na reunião.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : editing ? "Salvar" : "Criar reunião"}
        </Button>
      </div>
    </form>
  );
}

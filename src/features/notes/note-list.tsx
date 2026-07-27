"use client";

import * as React from "react";
import useSWR from "swr";
import { Plus, Pin, Pencil, Trash2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown/markdown";
import { NoteFormDialog, type NoteFormValues } from "./note-form-dialog";

interface ProjectNote {
  id: string;
  title: string | null;
  content: string;
  isPinned: boolean;
  updatedAt: string;
}

export function NoteList({
  projectId,
  initialNotes,
}: {
  projectId: string;
  initialNotes: ProjectNote[];
}) {
  const { data: notes, mutate } = useSWR<ProjectNote[]>(
    `/api/projects/${projectId}/notes`,
    fetcher,
    { fallbackData: initialNotes },
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectNote | null>(null);
  const [deleting, setDeleting] = React.useState<ProjectNote | null>(null);

  async function handleSubmit(values: NoteFormValues) {
    if (editing) {
      await apiRequest(`/api/notes/${editing.id}`, "PATCH", values);
      toast.success("Nota atualizada.");
    } else {
      await apiRequest(`/api/projects/${projectId}/notes`, "POST", values);
      toast.success("Nota criada.");
    }
    setEditing(null);
    mutate();
  }

  async function handleDelete() {
    if (!deleting) return;
    await apiRequest(`/api/notes/${deleting.id}`, "DELETE");
    toast.success("Nota removida.");
    setDeleting(null);
    mutate();
  }

  const list = notes ?? [];

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova nota
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Nenhuma nota ainda"
          description="Registre informações relevantes do projeto em markdown."
          action={<Button onClick={() => setDialogOpen(true)}>Nova nota</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((note) => (
            <div
              key={note.id}
              className="group border-line bg-surface rounded-[var(--radius-lg)] border p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-display text-ink flex items-center gap-1.5 text-base font-medium">
                  {note.isPinned && <Pin className="text-accent h-3.5 w-3.5" />}
                  {note.title || "Sem título"}
                </h3>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(note);
                      setDialogOpen(true);
                    }}
                    aria-label="Editar nota"
                    className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(note)}
                    aria-label="Excluir nota"
                    className="text-ink-muted hover:bg-danger-soft hover:text-danger rounded-[var(--radius-sm)] p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="line-clamp-6 text-sm">
                <Markdown content={note.content} />
              </div>
            </div>
          ))}
        </div>
      )}

      <NoteFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialValues={
          editing
            ? {
                id: editing.id,
                title: editing.title,
                content: editing.content,
                isPinned: editing.isPinned,
              }
            : null
        }
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Excluir nota?"
        description={`"${deleting?.title || "Sem título"}" será removida permanentemente.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}

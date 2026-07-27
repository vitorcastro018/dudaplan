"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown/markdown";
import { cn } from "@/lib/utils";

export interface NoteFormValues {
  title: string | null;
  content: string;
  isPinned: boolean;
}

export interface NoteFormInitialValues extends NoteFormValues {
  id: string;
}

export function NoteFormDialog({
  open,
  onClose,
  onSubmit,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: NoteFormValues) => Promise<void>;
  initialValues: NoteFormInitialValues | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initialValues ? "Editar nota" : "Nova nota"}
      className="max-w-2xl"
    >
      {open && (
        <NoteForm
          key={initialValues?.id ?? "new"}
          onClose={onClose}
          onSubmit={onSubmit}
          initialValues={initialValues}
        />
      )}
    </Dialog>
  );
}

function NoteForm({
  onClose,
  onSubmit,
  initialValues,
}: {
  onClose: () => void;
  onSubmit: (values: NoteFormValues) => Promise<void>;
  initialValues: NoteFormInitialValues | null;
}) {
  const [title, setTitle] = React.useState(initialValues?.title ?? "");
  const [content, setContent] = React.useState(initialValues?.content ?? "");
  const [isPinned, setIsPinned] = React.useState(initialValues?.isPinned ?? false);
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ title: title || null, content, isPinned });
      onClose();
    } catch {
      toast.error("Não foi possível salvar a nota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Opcional"
          autoFocus
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="mb-0">Conteúdo (markdown)</Label>
          <div className="bg-paper-sunk flex gap-1 rounded-[var(--radius-sm)] p-0.5">
            <button
              type="button"
              onClick={() => setTab("edit")}
              className={cn(
                "rounded-[4px] px-2.5 py-1 text-xs font-medium",
                tab === "edit" ? "bg-surface text-ink shadow-sm" : "text-ink-muted",
              )}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={cn(
                "rounded-[4px] px-2.5 py-1 text-xs font-medium",
                tab === "preview" ? "bg-surface text-ink shadow-sm" : "text-ink-muted",
              )}
            >
              Pré-visualizar
            </button>
          </div>
        </div>
        {tab === "edit" ? (
          <Textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="font-mono text-sm"
          />
        ) : (
          <div className="border-line-strong bg-surface min-h-[220px] rounded-[var(--radius-sm)] border px-3 py-2">
            {content ? (
              <Markdown content={content} />
            ) : (
              <p className="text-ink-muted text-sm">Nada para pré-visualizar ainda.</p>
            )}
          </div>
        )}
      </div>

      <label className="text-ink-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
          className="border-line-strong accent-accent h-4 w-4 rounded"
        />
        Fixar no topo
      </label>

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

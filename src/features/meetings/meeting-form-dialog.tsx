"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface MeetingFormValues {
  title: string;
  participants: string[];
  contextNotes: string | null;
}

export function MeetingFormDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: MeetingFormValues) => Promise<void>;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Nova reunião">
      {open && <MeetingForm onClose={onClose} onSubmit={onSubmit} />}
    </Dialog>
  );
}

function MeetingForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: MeetingFormValues) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [participants, setParticipants] = React.useState("");
  const [contextNotes, setContextNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title,
        participants: participants
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        contextNotes: contextNotes || null,
      });
      onClose();
    } catch {
      toast.error("Não foi possível criar a reunião.");
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
          placeholder="Reunião de alinhamento semanal"
          required
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="participants">Participantes</Label>
        <Input
          id="participants"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          placeholder="Separados por vírgula"
        />
      </div>

      <div>
        <Label htmlFor="contextNotes">Contexto para a IA</Label>
        <Textarea
          id="contextNotes"
          rows={3}
          value={contextNotes}
          onChange={(e) => setContextNotes(e.target.value)}
          placeholder="Pauta, termos específicos do projeto, nomes próprios..."
        />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Criando..." : "Criar reunião"}
        </Button>
      </div>
    </form>
  );
}

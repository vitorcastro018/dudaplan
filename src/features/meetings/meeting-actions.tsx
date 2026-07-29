"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteMeeting } from "@/lib/actions/meetings";
import {
  MeetingFormDialog,
  type MeetingProjectOption,
} from "@/features/meetings/meeting-form-dialog";
import type { MeetingDetail } from "@/lib/data/meetings";

export function MeetingActions({
  meeting,
  projects,
}: {
  meeting: MeetingDetail;
  projects: MeetingProjectOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMeeting(meeting.id);
      if (result.ok) {
        toast.success("Reunião excluída.");
        router.push("/reunioes");
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
      <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
        <Trash2 className="h-4 w-4" />
        Excluir
      </Button>

      {editing && (
        <MeetingFormDialog
          meeting={meeting}
          projects={projects}
          open
          onClose={() => setEditing(false)}
          defaultScheduledAt={meeting.scheduledInput ?? undefined}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir reunião"
        description={`"${meeting.title}", os participantes e o áudio serão apagados definitivamente.`}
        confirmLabel="Excluir"
      />
    </>
  );
}

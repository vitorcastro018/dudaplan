"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { archiveClient } from "@/lib/actions/clients";
import { ClientFormDialog } from "@/features/clients/client-form-dialog";
import type { ClientListItem } from "@/lib/data/clients";

/** Editar e arquivar, no cabeçalho da página do cliente (o card da lista é um `<Link>`). */
export function ClientActions({ client }: { client: ClientListItem }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveClient(client.id);
      if (result.ok) {
        toast.success("Cliente arquivado.");
        router.push("/clientes");
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

      {editing && <ClientFormDialog client={client} open onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={handleArchive}
        title="Arquivar cliente"
        description={`"${client.name}" sai da lista. Projetos, tarefas e reuniões continuam existindo.`}
        confirmLabel="Arquivar"
      />
    </>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { createClient, updateClient } from "@/lib/actions/clients";
import type { ClientListItem } from "@/lib/data/clients";

/** Criar e editar compartilham o formulário; `client` ausente = criar. */
export function ClientFormDialog({
  client,
  open,
  onClose,
}: {
  client?: ClientListItem;
  open: boolean;
  onClose: () => void;
}) {
  const editing = client !== undefined;
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (editing) {
        const value = (key: string) => String(formData.get(key) ?? "").trim();
        const result = await updateClient(client.id, {
          name: value("name"),
          description: value("description") || null,
          contact: value("contact") || null,
        });
        if (result.ok) {
          onClose();
          toast.success("Cliente atualizado.");
        } else {
          toast.error(result.error);
        }
        return;
      }

      const result = await createClient(formData);
      if (result.ok) {
        onClose();
        toast.success("Cliente criado.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Editar cliente" : "Novo cliente"}
      className="max-h-[85dvh] overflow-y-auto"
    >
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="client-name">
            Nome<span className="text-danger ml-0.5">*</span>
          </Label>
          <Input
            id="client-name"
            name="name"
            defaultValue={client?.name}
            required
            maxLength={200}
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="client-contact">Contato</Label>
          <Input
            id="client-contact"
            name="contact"
            defaultValue={client?.contact ?? ""}
            maxLength={2000}
            placeholder="Nome, e-mail, telefone"
          />
        </div>

        <div>
          <Label htmlFor="client-description">Sobre o cliente</Label>
          <Textarea
            id="client-description"
            name="description"
            defaultValue={client?.description ?? ""}
            maxLength={2000}
            rows={4}
            placeholder="O que ele faz, combinados gerais, o que vale lembrar."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : editing ? "Salvar" : "Criar cliente"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

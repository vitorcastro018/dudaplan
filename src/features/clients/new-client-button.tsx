"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/features/clients/client-form-dialog";

export function NewClientButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo cliente
      </Button>
      {/* Montado só enquanto aberto, para reabrir limpo. */}
      {open && <ClientFormDialog open onClose={() => setOpen(false)} />}
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateActionItems } from "@/lib/actions/meeting-action-items";

export function ActionItemsButton({
  meetingId,
  hasItems,
  canGenerate,
}: {
  meetingId: string;
  hasItems: boolean;
  /** Há transcrição salva ou áudio para transcrever. */
  canGenerate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateActionItems(meetingId);
      if (result.ok) {
        toast.success("Próximos passos identificados.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={hasItems ? "secondary" : "primary"}
      onClick={handleClick}
      disabled={pending || !canGenerate}
      title={canGenerate ? undefined : "Envie ou grave um áudio primeiro"}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
      {pending ? "Procurando tarefas..." : hasItems ? "Gerar novamente" : "Gerar tarefas"}
    </Button>
  );
}

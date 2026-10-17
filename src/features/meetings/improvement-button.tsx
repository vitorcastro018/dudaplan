"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateProcessImprovement } from "@/lib/actions/meeting-improvement";

export function ImprovementButton({
  meetingId,
  hasImprovement,
  canGenerate,
}: {
  meetingId: string;
  hasImprovement: boolean;
  /** Há transcrição salva ou áudio para transcrever. */
  canGenerate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateProcessImprovement(meetingId);
      if (result.ok) {
        toast.success("Sugestão de melhoria gerada.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={hasImprovement ? "secondary" : "primary"}
      onClick={handleClick}
      disabled={pending || !canGenerate}
      title={canGenerate ? undefined : "Envie ou grave um áudio primeiro"}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
      {pending
        ? "Analisando o processo..."
        : hasImprovement
          ? "Gerar novamente"
          : "Sugestão de melhoria"}
    </Button>
  );
}

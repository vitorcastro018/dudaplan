"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateDiagnosis } from "@/lib/actions/meeting-diagnosis";

export function DiagnosisButton({
  meetingId,
  hasDiagnosis,
  canGenerate,
}: {
  meetingId: string;
  hasDiagnosis: boolean;
  /** Há transcrição salva ou áudio para transcrever. */
  canGenerate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateDiagnosis(meetingId);
      if (result.ok) {
        toast.success("Diagnóstico gerado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={hasDiagnosis ? "secondary" : "primary"}
      onClick={handleClick}
      disabled={pending || !canGenerate}
      title={canGenerate ? undefined : "Envie ou grave um áudio primeiro"}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
      {pending ? "Analisando..." : hasDiagnosis ? "Gerar novamente" : "Diagnóstico de gargalos"}
    </Button>
  );
}

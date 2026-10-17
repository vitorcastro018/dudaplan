"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateMeetingSummary } from "@/lib/actions/meeting-summary";

export function SummarizeButton({
  meetingId,
  hasSummary,
  hasAudio,
}: {
  meetingId: string;
  hasSummary: boolean;
  hasAudio: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateMeetingSummary(meetingId);
      if (result.ok) {
        toast.success("Resumo gerado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={hasSummary ? "secondary" : "primary"}
      onClick={handleClick}
      disabled={pending || !hasAudio}
      title={hasAudio ? undefined : "Envie ou grave um áudio primeiro"}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Gerando resumo..." : hasSummary ? "Gerar novamente" : "Resumo com IA"}
    </Button>
  );
}

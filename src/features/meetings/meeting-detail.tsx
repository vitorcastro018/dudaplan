"use client";

import * as React from "react";
import useSWR from "swr";
import { Users, Calendar, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MeetingRecorder } from "./meeting-recorder";
import { ProcessingTimeline } from "./processing-timeline";
import { MeetingResults } from "./meeting-results";
import { MEETING_STATUS_LABELS, MEETING_STATUS_TONE } from "./status";

export interface MeetingDetailData {
  id: string;
  title: string;
  meetingDate: string;
  participants: string[];
  contextNotes: string | null;
  status: string;
  audioPath: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  summaryMarkdown: string | null;
  problems: unknown;
  actionPlan: unknown;
  risks: unknown;
  decisions: unknown;
  flowchartMermaid: string | null;
  flowchartTitle: string | null;
  transcript: string | null;
}

const PROCESSING_STATUSES = ["TRANSCRIBING", "ANALYZING"];

export function MeetingDetail({ initialMeeting }: { initialMeeting: MeetingDetailData }) {
  const { data: meeting, mutate } = useSWR<MeetingDetailData>(
    `/api/meetings/${initialMeeting.id}`,
    fetcher,
    {
      fallbackData: initialMeeting,
      refreshInterval: (data) => (data && PROCESSING_STATUSES.includes(data.status) ? 3000 : 0),
    },
  );

  const current = meeting ?? initialMeeting;
  const [processing, setProcessing] = React.useState(false);

  async function handleProcess(force = false) {
    setProcessing(true);
    try {
      await apiRequest(`/api/meetings/${current.id}/process${force ? "?force=1" : ""}`, "POST");
      mutate();
    } catch {
      toast.error("Não foi possível iniciar o processamento.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-ink-muted flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(current.meetingDate).toLocaleDateString("pt-BR")}
            </span>
            {current.participants.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {current.participants.join(", ")}
              </span>
            )}
          </div>
        </div>
        <Badge tone={MEETING_STATUS_TONE[current.status] ?? "neutral"}>
          {MEETING_STATUS_LABELS[current.status] ?? current.status}
        </Badge>
      </div>

      {current.audioPath && (
        <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-4">
          <p className="section-label mb-2">Áudio</p>
          <audio controls src={`/api/meetings/${current.id}/audio`} className="w-full" />
        </div>
      )}

      {(current.status === "DRAFT" || current.status === "UPLOADED") && (
        <MeetingRecorder meetingId={current.id} onUploaded={() => mutate()} />
      )}

      {current.status === "UPLOADED" && (
        <div className="flex justify-end">
          <Button onClick={() => handleProcess(false)} disabled={processing}>
            <Sparkles className="h-4 w-4" />
            {processing ? "Iniciando..." : "Processar com IA"}
          </Button>
        </div>
      )}

      {PROCESSING_STATUSES.includes(current.status) && (
        <ProcessingTimeline status={current.status} />
      )}

      {current.status === "FAILED" && (
        <div className="border-danger-soft bg-danger-soft rounded-[var(--radius-lg)] border p-4">
          <p className="text-danger mb-3 text-sm">
            {current.errorMessage || "Ocorreu um erro ao processar a reunião."}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleProcess(false)}
            disabled={processing}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {current.status === "COMPLETED" && (
        <>
          <MeetingResults
            meetingId={current.id}
            summaryMarkdown={current.summaryMarkdown}
            problems={(current.problems as never) ?? []}
            actionPlan={(current.actionPlan as never) ?? []}
            risks={(current.risks as never) ?? []}
            decisions={(current.decisions as never) ?? []}
            flowchartMermaid={current.flowchartMermaid}
            flowchartTitle={current.flowchartTitle}
            transcript={current.transcript}
            onRefresh={() => mutate()}
          />
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleProcess(true)}
              disabled={processing}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reprocessar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

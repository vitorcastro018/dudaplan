"use client";

import useSWR from "swr";
import { Users, Calendar } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { MeetingRecorder } from "./meeting-recorder";
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
}

export function MeetingDetail({ initialMeeting }: { initialMeeting: MeetingDetailData }) {
  const { data: meeting, mutate } = useSWR<MeetingDetailData>(
    `/api/meetings/${initialMeeting.id}`,
    fetcher,
    { fallbackData: initialMeeting },
  );

  const current = meeting ?? initialMeeting;

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

      <MeetingRecorder meetingId={current.id} onUploaded={() => mutate()} />
    </div>
  );
}

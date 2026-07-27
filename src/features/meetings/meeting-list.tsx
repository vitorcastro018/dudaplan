"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Video, Users } from "lucide-react";
import { toast } from "sonner";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingFormDialog, type MeetingFormValues } from "./meeting-form-dialog";
import { MEETING_STATUS_LABELS, MEETING_STATUS_TONE } from "./status";

interface MeetingListItem {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
  durationSeconds: number | null;
  participants: string[];
}

export function MeetingList({
  projectId,
  projectSlug,
  initialMeetings,
}: {
  projectId: string;
  projectSlug: string;
  initialMeetings: MeetingListItem[];
}) {
  const router = useRouter();
  const { data: meetings, mutate } = useSWR<MeetingListItem[]>(
    `/api/projects/${projectId}/meetings`,
    fetcher,
    { fallbackData: initialMeetings },
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const list = meetings ?? [];

  async function handleCreate(values: MeetingFormValues) {
    const meeting = await apiRequest<{ id: string }>(
      `/api/projects/${projectId}/meetings`,
      "POST",
      values,
    );
    toast.success("Reunião criada.");
    mutate();
    router.push(`/projetos/${projectSlug}/reunioes/${meeting.id}`);
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova reunião
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Video}
          title="Nenhuma reunião ainda"
          description="Crie uma reunião para gravar o áudio e gerar ata, plano de ação e fluxograma com IA."
          action={<Button onClick={() => setDialogOpen(true)}>Nova reunião</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/projetos/${projectSlug}/reunioes/${meeting.id}`}
              className="border-line bg-surface hover:border-line-strong flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate font-medium">{meeting.title}</p>
                <div className="text-ink-muted mt-0.5 flex items-center gap-3 text-xs">
                  <span className="font-mono">
                    {new Date(meeting.meetingDate).toLocaleDateString("pt-BR")}
                  </span>
                  {meeting.participants.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {meeting.participants.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <Badge tone={MEETING_STATUS_TONE[meeting.status] ?? "neutral"}>
                {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <MeetingFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}

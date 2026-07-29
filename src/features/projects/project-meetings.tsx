"use client";

import * as React from "react";
import Link from "next/link";
import { AudioLines, CalendarClock, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MeetingFormDialog,
  type MeetingProjectOption,
} from "@/features/meetings/meeting-form-dialog";
import type { MeetingSummary } from "@/lib/data/meetings";

/**
 * As reuniões deste projeto, no mesmo lugar em que as tarefas aparecem.
 *
 * O card já leva ao detalhe da reunião, então não há edição em linha aqui — o
 * botão só cria, com o projeto atual pré-selecionado no formulário.
 */
export function ProjectMeetings({
  projectId,
  meetings,
  projects,
  /** Data/hora sugerida no formulário, calculada no servidor pelo APP_TIMEZONE. */
  defaultScheduledAt,
}: {
  projectId: string;
  meetings: MeetingSummary[];
  projects: MeetingProjectOption[];
  defaultScheduledAt: string;
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-ink text-lg font-medium tracking-tight">Reuniões</h2>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nova reunião
        </Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          title="Sem reuniões"
          description="Registre a primeira reunião deste projeto."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/reunioes/${meeting.id}`}
              className="border-line bg-surface hover:border-line-strong flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-ink text-base font-medium tracking-tight">
                  {meeting.title}
                </h3>
                {meeting.hasAudio && (
                  <Badge tone="pine">
                    <AudioLines className="mr-1 inline h-3 w-3" />
                    Áudio
                  </Badge>
                )}
              </div>

              <div className="text-ink-muted flex flex-col gap-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  {meeting.scheduledLabel ?? "Sem data marcada"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {meeting.participantCount === 1
                    ? "1 participante"
                    : `${meeting.participantCount} participantes`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <MeetingFormDialog
          projects={projects}
          open
          onClose={() => setCreating(false)}
          defaultScheduledAt={defaultScheduledAt}
          defaultProjectId={projectId}
        />
      )}
    </section>
  );
}

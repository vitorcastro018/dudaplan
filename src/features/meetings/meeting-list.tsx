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

export function MeetingList({
  meetings,
  projects,
  /** Sugestão de data/hora do formulário, calculada no servidor para respeitar
   *  o APP_TIMEZONE em vez do fuso do navegador. */
  defaultScheduledAt,
}: {
  meetings: MeetingSummary[];
  projects: MeetingProjectOption[];
  defaultScheduledAt: string;
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nova reunião
        </Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          title="Nenhuma reunião ainda"
          description="Crie a primeira para registrar participantes, anotações e o áudio."
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
                <h2 className="font-display text-ink text-lg font-medium tracking-tight">
                  {meeting.title}
                </h2>
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

              {meeting.projectName && (
                <p className="text-ink-2 mt-auto truncate text-sm">
                  <span className="section-label mr-1.5">Projeto</span>
                  {meeting.projectName}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Montado só enquanto aberto: os campos são não-controlados, então
          remontar é o que garante que ele reabra limpo. */}
      {creating && (
        <MeetingFormDialog
          projects={projects}
          open
          onClose={() => setCreating(false)}
          defaultScheduledAt={defaultScheduledAt}
        />
      )}
    </div>
  );
}

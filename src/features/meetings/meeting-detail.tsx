import Link from "next/link";
import { CalendarClock, FolderKanban } from "lucide-react";
import { Markdown } from "@/components/markdown/markdown";
import { EmptyState } from "@/components/ui/empty-state";
import type { MeetingDetail as MeetingDetailData } from "@/lib/data/meetings";

/** A aba "Detalhes". Server Component: só leitura, e as anotações passam pelo
 *  `Markdown`, que renderiza no servidor. */
export function MeetingDetail({
  meeting,
  projectName,
}: {
  meeting: MeetingDetailData;
  projectName: string | null;
}) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="border-line bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5">
        <p className="text-ink-2 flex items-center gap-2 text-sm">
          <CalendarClock className="text-ink-muted h-4 w-4 shrink-0" />
          {meeting.scheduledLabel ?? "Sem data marcada"}
        </p>

        <p className="text-ink-2 flex items-center gap-2 text-sm">
          <FolderKanban className="text-ink-muted h-4 w-4 shrink-0" />
          {meeting.project_id && projectName ? (
            <Link href={`/projetos/${meeting.project_id}`} className="text-accent hover:underline">
              {projectName}
            </Link>
          ) : (
            <span className="text-ink-muted">Sem projeto</span>
          )}
        </p>
      </div>

      <section>
        <p className="section-label mb-3">Participantes</p>
        {meeting.participants.length === 0 ? (
          <p className="text-ink-muted text-sm">Ninguém registrado ainda.</p>
        ) : (
          <ul className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
            {meeting.participants.map((participant) => (
              <li key={participant.id} className="text-ink-2 px-4 py-2.5 text-sm">
                {participant.external_name ?? "Sem nome"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="section-label mb-3">Anotações</p>
        {meeting.notes ? (
          <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
            <Markdown content={meeting.notes} />
          </div>
        ) : (
          <EmptyState
            title="Sem anotações"
            description="Use o botão Editar para registrar o que foi discutido."
          />
        )}
      </section>
    </div>
  );
}

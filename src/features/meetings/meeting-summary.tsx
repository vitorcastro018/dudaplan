import { Markdown } from "@/components/markdown/markdown";
import { SummarizeButton } from "@/features/meetings/summarize-button";
import type { MeetingDetail } from "@/lib/data/meetings";

/**
 * O resumo com IA e o botão que o gera. Server Component: o Markdown renderiza
 * no servidor, e o resumo guardado na reunião abre sem nenhuma chamada à OpenAI.
 */
export function MeetingSummary({ meeting }: { meeting: MeetingDetail }) {
  return (
    <section className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Resumo com IA</p>
          {meeting.summaryLabel && (
            <p className="text-ink-muted mt-1 text-xs">Gerado em {meeting.summaryLabel}</p>
          )}
        </div>
        <SummarizeButton
          meetingId={meeting.id}
          hasSummary={meeting.summary !== null}
          hasAudio={meeting.recording !== null}
        />
      </div>

      {meeting.summary ? (
        <>
          <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
            <Markdown content={meeting.summary} />
          </div>

          {meeting.transcript && (
            <details className="border-line bg-surface rounded-[var(--radius-lg)] border">
              <summary className="text-ink-2 cursor-pointer px-5 py-3 text-sm font-medium">
                Ver transcrição
              </summary>
              <p className="text-ink-2 border-line border-t px-5 py-4 text-sm leading-relaxed whitespace-pre-line">
                {meeting.transcript}
              </p>
            </details>
          )}
        </>
      ) : (
        <p className="text-ink-muted text-sm">
          {meeting.recording
            ? "Clique em Resumo com IA para transcrever o áudio e gerar o resumo. Ele fica salvo aqui."
            : "Envie ou grave um áudio para poder gerar o resumo."}
        </p>
      )}
    </section>
  );
}

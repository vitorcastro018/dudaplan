import { Badge } from "@/components/ui/badge";
import { ImprovementButton } from "@/features/meetings/improvement-button";
import { ProcessDiagram } from "@/features/meetings/process-diagram";
import { toMermaid } from "@/lib/ai/improvement";
import type { MeetingDetail } from "@/lib/data/meetings";

const EFFORT = {
  baixo: { label: "Esforço baixo", tone: "pine" },
  medio: { label: "Esforço médio", tone: "ochre" },
  alto: { label: "Esforço alto", tone: "danger" },
} as const;

const LEGEND = [
  { color: "bg-coral", label: "Gargalo" },
  { color: "bg-pine", label: "Novo" },
  { color: "bg-accent-ink", label: "Automatizado" },
  { color: "bg-ochre", label: "Alterado" },
];

/**
 * A sugestão de melhoria de processo: o processo atual e o sugerido em Mermaid,
 * lado a lado, mais a lista de mudanças. Server Component; só o desenho do
 * diagrama roda no navegador. O que está salvo abre sem chamar a OpenAI.
 */
export function MeetingImprovement({ meeting }: { meeting: MeetingDetail }) {
  const improvement = meeting.improvement;
  const canGenerate = meeting.transcript !== null || meeting.recording !== null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Sugestão de melhoria de processo</p>
          {meeting.improvementLabel && (
            <p className="text-ink-muted mt-1 text-xs">Gerada em {meeting.improvementLabel}</p>
          )}
        </div>
        <ImprovementButton
          meetingId={meeting.id}
          hasImprovement={improvement !== null}
          canGenerate={canGenerate}
        />
      </div>

      {!improvement && (
        <p className="text-ink-muted text-sm">
          {canGenerate
            ? "Clique em Sugestão de melhoria para a IA desenhar o processo atual e propor uma versão melhor. Fica salvo aqui."
            : "Envie ou grave um áudio para poder gerar a sugestão."}
        </p>
      )}

      {improvement && !improvement.hasProcess && (
        <p className="border-line bg-surface text-ink-2 rounded-[var(--radius-lg)] border p-5 text-sm">
          {improvement.reason ?? "A reunião não descreve um processo que dê para desenhar."}
        </p>
      )}

      {improvement?.hasProcess && improvement.current && improvement.proposed && (
        <>
          {improvement.overview && (
            <p className="text-ink-2 max-w-3xl text-sm leading-relaxed">{improvement.overview}</p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
              <Badge tone="danger">Processo atual</Badge>
              <div className="mt-4">
                <ProcessDiagram definition={toMermaid(improvement.current)} />
              </div>
            </div>
            <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
              <Badge tone="pine">Processo sugerido pela IA</Badge>
              <div className="mt-4">
                <ProcessDiagram definition={toMermaid(improvement.proposed)} />
              </div>
            </div>
          </div>

          <ul className="text-ink-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                {item.label}
              </li>
            ))}
          </ul>

          {improvement.changes.length > 0 && (
            <div className="mt-2 flex flex-col gap-3">
              <p className="section-label">O que muda</p>
              <ul className="grid gap-3 md:grid-cols-2">
                {improvement.changes.map((change, i) => (
                  <li
                    key={i}
                    className="border-line bg-surface flex flex-col gap-2 rounded-[var(--radius-lg)] border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-ink text-sm font-medium">{change.title}</p>
                      <Badge tone={EFFORT[change.effort].tone} className="shrink-0">
                        {EFFORT[change.effort].label}
                      </Badge>
                    </div>
                    {change.why && <p className="text-ink-2 text-sm">{change.why}</p>}
                    {change.gain && <p className="text-pine text-sm">{change.gain}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

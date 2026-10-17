import { Badge } from "@/components/ui/badge";
import { DiagnosisButton } from "@/features/meetings/diagnosis-button";
import type { FindingCategory, FindingSeverity } from "@/lib/ai/diagnosis";
import type { MeetingDetail } from "@/lib/data/meetings";

const CATEGORY: Record<
  FindingCategory,
  { label: string; tone: "danger" | "ochre" | "accent" | "plum" }
> = {
  gargalo: { label: "Gargalo", tone: "danger" },
  retrabalho: { label: "Retrabalho", tone: "ochre" },
  manual: { label: "Trabalho manual", tone: "accent" },
  risco: { label: "Risco", tone: "plum" },
};

const SEVERITY: Record<FindingSeverity, { label: string; tone: "danger" | "ochre" | "neutral" }> = {
  alta: { label: "Gravidade alta", tone: "danger" },
  media: { label: "Gravidade média", tone: "ochre" },
  baixa: { label: "Gravidade baixa", tone: "neutral" },
};

/**
 * O diagnóstico de gargalos: os problemas do processo que apareceram na
 * reunião, do mais grave ao menos grave, cada um com o trecho da conversa que o
 * sustenta. Server Component; o que está salvo abre sem chamar a OpenAI.
 */
export function MeetingDiagnosis({ meeting }: { meeting: MeetingDetail }) {
  const diagnosis = meeting.diagnosis;
  const canGenerate = meeting.transcript !== null || meeting.recording !== null;

  return (
    <section className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Diagnóstico de gargalos</p>
          {meeting.diagnosisLabel && (
            <p className="text-ink-muted mt-1 text-xs">Gerado em {meeting.diagnosisLabel}</p>
          )}
        </div>
        <DiagnosisButton
          meetingId={meeting.id}
          hasDiagnosis={diagnosis !== null}
          canGenerate={canGenerate}
        />
      </div>

      {!diagnosis && (
        <p className="text-ink-muted text-sm">
          {canGenerate
            ? "Clique em Diagnóstico de gargalos para a IA apontar os problemas do processo, cada um com o trecho da conversa que o mostra."
            : "Envie ou grave um áudio para poder gerar o diagnóstico."}
        </p>
      )}

      {diagnosis && !diagnosis.hasFindings && (
        <p className="border-line bg-surface text-ink-2 rounded-[var(--radius-lg)] border p-5 text-sm">
          {diagnosis.reason ?? "A IA não encontrou problemas de processo nessa reunião."}
        </p>
      )}

      {diagnosis?.hasFindings && (
        <ul className="flex flex-col gap-3">
          {diagnosis.findings.map((finding, i) => (
            <li
              key={i}
              className="border-line bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={CATEGORY[finding.category].tone}>
                  {CATEGORY[finding.category].label}
                </Badge>
                <Badge tone={SEVERITY[finding.severity].tone}>
                  {SEVERITY[finding.severity].label}
                </Badge>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-ink text-sm font-medium">{finding.title}</p>
                {finding.description && <p className="text-ink-2 text-sm">{finding.description}</p>}
              </div>

              {finding.quote && (
                <blockquote className="border-accent text-ink-muted border-l-2 pl-3 text-sm italic">
                  “{finding.quote}”
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

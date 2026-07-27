"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Code2 } from "lucide-react";
import { apiRequest } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown/markdown";
import { MermaidDiagram } from "./mermaid-diagram";

interface ProblemItem {
  title: string;
  description: string;
  severity: "baixa" | "media" | "alta";
  evidence: string | null;
}

interface ActionItem {
  title: string;
  description: string;
  owner: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueHint: string | null;
}

interface RiskItem {
  description: string;
  mitigation: string;
}

interface DecisionItem {
  description: string;
  owner: string | null;
}

const SEVERITY_TONE: Record<string, "neutral" | "ochre" | "danger"> = {
  baixa: "neutral",
  media: "ochre",
  alta: "danger",
};

const TABS = ["ata", "problemas", "plano", "fluxograma", "transcricao"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  ata: "Ata",
  problemas: "Problemas",
  plano: "Plano de ação",
  fluxograma: "Fluxograma",
  transcricao: "Transcrição",
};

export function MeetingResults({
  meetingId,
  summaryMarkdown,
  problems,
  actionPlan,
  risks,
  decisions,
  flowchartMermaid,
  flowchartTitle,
  transcript,
  onRefresh,
}: {
  meetingId: string;
  summaryMarkdown: string | null;
  problems: ProblemItem[];
  actionPlan: ActionItem[];
  risks: RiskItem[];
  decisions: DecisionItem[];
  flowchartMermaid: string | null;
  flowchartTitle: string | null;
  transcript: string | null;
  onRefresh: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("ata");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [importing, setImporting] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [showCode, setShowCode] = React.useState(false);

  function toggleSelected(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImport() {
    setImporting(true);
    try {
      await apiRequest(`/api/meetings/${meetingId}/action-plan/import`, "POST", {
        indexes: Array.from(selected),
      });
      toast.success("Tarefas criadas a partir do plano de ação.");
      setSelected(new Set());
      onRefresh();
    } catch {
      toast.error("Não foi possível importar as tarefas.");
    } finally {
      setImporting(false);
    }
  }

  async function handleRegenerateFlowchart() {
    setRegenerating(true);
    try {
      await apiRequest(`/api/meetings/${meetingId}/flowchart/regenerate`, "POST");
      toast.success("Fluxograma regenerado.");
      onRefresh();
    } catch {
      toast.error("Não foi possível regenerar o fluxograma.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div>
      <div className="border-line mb-5 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-accent text-ink"
                : "text-ink-muted hover:text-ink border-transparent"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "ata" && (
        <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
          {summaryMarkdown ? (
            <Markdown content={summaryMarkdown} />
          ) : (
            <p className="text-ink-muted text-sm">Nenhuma ata gerada ainda.</p>
          )}
          {decisions.length > 0 && (
            <div className="border-line mt-4 border-t pt-4">
              <p className="section-label mb-2">Decisões</p>
              <ul className="text-ink-2 flex flex-col gap-1.5 text-sm">
                {decisions.map((decision, i) => (
                  <li key={i}>
                    {decision.description}
                    {decision.owner && <span className="text-ink-muted"> — {decision.owner}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {risks.length > 0 && (
            <div className="border-line mt-4 border-t pt-4">
              <p className="section-label mb-2">Riscos</p>
              <ul className="flex flex-col gap-2 text-sm">
                {risks.map((risk, i) => (
                  <li key={i}>
                    <span className="text-ink-2">{risk.description}</span>
                    <br />
                    <span className="text-ink-muted">Mitigação: {risk.mitigation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "problemas" && (
        <div className="flex flex-col gap-3">
          {problems.length === 0 ? (
            <p className="text-ink-muted text-sm">Nenhum problema identificado.</p>
          ) : (
            problems.map((problem, i) => (
              <div key={i} className="border-line bg-surface rounded-[var(--radius-lg)] border p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-ink font-medium">{problem.title}</p>
                  <Badge tone={SEVERITY_TONE[problem.severity]}>{problem.severity}</Badge>
                </div>
                <p className="text-ink-2 text-sm">{problem.description}</p>
                {problem.evidence && (
                  <p className="text-ink-muted mt-1.5 text-xs italic">
                    &ldquo;{problem.evidence}&rdquo;
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "plano" && (
        <div>
          {actionPlan.length === 0 ? (
            <p className="text-ink-muted text-sm">Nenhuma ação sugerida.</p>
          ) : (
            <>
              <div className="mb-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing}
                >
                  {importing ? "Importando..." : `Importar selecionadas (${selected.size})`}
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {actionPlan.map((item, i) => (
                  <label
                    key={i}
                    className="border-line bg-surface flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-4"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelected(i)}
                      className="border-line-strong accent-accent mt-1 h-4 w-4 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-ink font-medium">{item.title}</p>
                        <Badge
                          tone={
                            item.priority === "HIGH"
                              ? "danger"
                              : item.priority === "MEDIUM"
                                ? "ochre"
                                : "neutral"
                          }
                        >
                          {item.priority}
                        </Badge>
                      </div>
                      <p className="text-ink-2 text-sm">{item.description}</p>
                      {(item.owner || item.dueHint) && (
                        <p className="text-ink-muted mt-1 text-xs">
                          {item.owner && `Responsável: ${item.owner}`}
                          {item.owner && item.dueHint && " · "}
                          {item.dueHint}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "fluxograma" && (
        <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-ink font-medium">{flowchartTitle || "Fluxograma"}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCode((s) => !s)}>
                <Code2 className="h-3.5 w-3.5" />
                {showCode ? "Ver diagrama" : "Ver código"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerateFlowchart}
                disabled={regenerating}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {regenerating ? "Gerando..." : "Regenerar"}
              </Button>
            </div>
          </div>
          {flowchartMermaid ? (
            showCode ? (
              <pre className="bg-paper-sunk text-ink-2 overflow-x-auto rounded-[var(--radius-sm)] p-3 font-mono text-xs">
                {flowchartMermaid}
              </pre>
            ) : (
              <MermaidDiagram code={flowchartMermaid} />
            )
          ) : (
            <p className="text-ink-muted text-sm">Nenhum fluxograma gerado ainda.</p>
          )}
        </div>
      )}

      {tab === "transcricao" && (
        <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-4">
          <div className="mb-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (transcript) {
                  navigator.clipboard.writeText(transcript);
                  toast.success("Transcrição copiada.");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
          <pre className="text-ink-2 max-h-[500px] overflow-y-auto font-mono text-xs whitespace-pre-wrap">
            {transcript || "Nenhuma transcrição disponível."}
          </pre>
        </div>
      )}
    </div>
  );
}

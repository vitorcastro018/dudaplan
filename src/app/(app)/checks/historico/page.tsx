import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getDailyChecksSummary } from "@/lib/data/daily-checks";
import { cn } from "@/lib/utils";

export default async function ChecksHistoricoPage() {
  const summary = await getDailyChecksSummary(30);

  return (
    <div>
      <PageHeader
        title="Histórico"
        description="Últimos 30 dias de conclusão dos seus checks diários."
        actions={
          <LinkButton href="/checks" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </LinkButton>
        }
      />

      {summary.checks.length === 0 ? (
        <EmptyState title="Nenhum check cadastrado ainda" />
      ) : (
        <div className="border-line bg-surface overflow-x-auto rounded-[var(--radius-lg)] border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-surface text-ink-muted sticky left-0 px-4 py-3 text-left font-medium">
                  Check
                </th>
                {summary.dateKeys.map((dateKey) => (
                  <th
                    key={dateKey}
                    className="text-ink-muted px-1 py-3 text-center font-mono text-[10px]"
                  >
                    {dateKey.slice(8, 10)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.checks.map((check) => {
                const completed = new Set(summary.completions[check.id] ?? []);
                return (
                  <tr key={check.id} className="border-line border-t">
                    <td className="bg-surface text-ink sticky left-0 px-4 py-2.5 font-medium whitespace-nowrap">
                      {check.emoji && <span className="mr-1.5">{check.emoji}</span>}
                      {check.title}
                    </td>
                    {summary.dateKeys.map((dateKey) => (
                      <td key={dateKey} className="px-1 py-2.5 text-center">
                        <span
                          className={cn(
                            "mx-auto block h-2.5 w-2.5 rounded-[3px]",
                            completed.has(dateKey) ? "bg-pine" : "bg-paper-sunk",
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

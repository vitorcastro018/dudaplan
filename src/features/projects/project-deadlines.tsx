import { daysBetween, formatDateKeyShort, formatDuration, isDateKey } from "@/lib/date-keys";
import { PROJECT_DEADLINES, projectBaseline } from "@/features/projects/deadlines";
import { cn } from "@/lib/utils";

type DeadlineSource = {
  start_date: string | null;
  created_at: string;
  deadline_optimistic: string;
  deadline_mediocre: string;
  deadline_realistic: string;
};

const TONE_DOT: Record<"pine" | "ochre" | "accent", string> = {
  pine: "bg-pine",
  ochre: "bg-ochre",
  accent: "bg-accent",
};

/**
 * Os três prazos com a duração de cada um.
 *
 * Server Component: só formata: nada aqui precisa de estado ou de evento, então
 * mandar para o navegador seria bundle sem contrapartida.
 */
export function ProjectDeadlines({
  project,
  className,
}: {
  project: DeadlineSource;
  className?: string;
}) {
  const baseline = projectBaseline(project);

  return (
    <dl className={cn("flex flex-col gap-1", className)}>
      {PROJECT_DEADLINES.map(({ column, label, tone }) => {
        const dateKey = project[column];
        const days = isDateKey(dateKey) ? daysBetween(baseline, dateKey) : null;

        return (
          <div key={column} className="flex items-center gap-2 text-xs">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />
            <dt className="text-ink-muted w-[104px] shrink-0">{label.replace("Prazo ", "")}</dt>
            <dd className="text-ink-2 flex flex-1 items-baseline justify-between gap-2 font-mono tabular-nums">
              <span>{formatDateKeyShort(dateKey)}</span>
              {days !== null && (
                <span className={cn(days < 0 ? "text-danger" : "text-ink-muted")}>
                  {formatDuration(days)}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

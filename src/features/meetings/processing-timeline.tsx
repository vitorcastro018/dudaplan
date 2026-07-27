import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "UPLOADED", label: "Áudio enviado" },
  { key: "TRANSCRIBING", label: "Transcrevendo" },
  { key: "ANALYZING", label: "Analisando" },
  { key: "COMPLETED", label: "Pronto" },
];

export function ProcessingTimeline({ status }: { status: string }) {
  const currentIndex = STEPS.findIndex((step) => step.key === status);

  return (
    <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isDone = currentIndex > index || status === "COMPLETED";
          const isCurrent = index === currentIndex && status !== "COMPLETED";
          return (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  isDone
                    ? "bg-pine text-white"
                    : isCurrent
                      ? "bg-plum text-white"
                      : "bg-paper-sunk text-ink-muted",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  index + 1
                )}
              </span>
              <span className={cn("text-xs", isDone || isCurrent ? "text-ink" : "text-ink-muted")}>
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <span className={cn("mx-2 h-px flex-1", isDone ? "bg-pine" : "bg-line")} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-ink-muted mt-4 text-sm">
        Isso pode levar alguns minutos, dependendo da duração da gravação. Você pode sair desta
        página — o processamento continua em segundo plano.
      </p>
    </div>
  );
}

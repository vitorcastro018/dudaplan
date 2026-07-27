import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line-strong bg-paper-sunk/40 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="bg-accent-soft text-accent-hover mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="font-display text-ink text-lg font-medium">{title}</p>
      {description && <p className="text-ink-muted mt-1.5 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-paper-sunk animate-pulse rounded-[var(--radius-sm)]", className)} />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label mb-3">{children}</p>;
}

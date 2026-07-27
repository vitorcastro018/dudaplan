"use client";

import * as React from "react";
import { Flame, Pencil, Archive, Trash2 } from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DailyCheckWithStatus } from "@/lib/data/daily-checks";

const TONE_BY_COLOR: Record<string, "accent" | "pine" | "ochre" | "plum"> = {
  accent: "accent",
  pine: "pine",
  ochre: "ochre",
  plum: "plum",
};

export function CheckRow({
  check,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
}: {
  check: DailyCheckWithStatus;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <div className="group border-line bg-surface flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3">
      <CheckSquare checked={check.isDone} onChange={onToggle} aria-label={check.title} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-display text-ink truncate text-base font-medium",
            check.isDone && "text-ink-muted line-through",
          )}
        >
          {check.emoji && <span className="mr-1.5">{check.emoji}</span>}
          {check.title}
        </p>
        {check.description && (
          <p className="text-ink-muted truncate text-sm">{check.description}</p>
        )}
      </div>

      {check.streak > 0 && (
        <Badge tone={TONE_BY_COLOR[check.colorToken] ?? "accent"}>
          <Flame className="h-3 w-3" />
          {check.streak} {check.streak === 1 ? "dia" : "dias"}
        </Badge>
      )}

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar"
          className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onArchive}
          aria-label="Arquivar"
          className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1.5"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Excluir"
          className="text-ink-muted hover:bg-danger-soft hover:text-danger rounded-[var(--radius-sm)] p-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Excluir check diário?"
        description={`"${check.title}" e todo o histórico de conclusões serão removidos permanentemente.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}

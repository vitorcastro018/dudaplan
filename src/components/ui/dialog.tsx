"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, description, className, children }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "border-line bg-surface text-ink backdrop:bg-ink/40 m-auto w-full max-w-lg rounded-[var(--radius-lg)] border p-0 shadow-[var(--shadow-pop)] backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="border-line flex items-start justify-between gap-4 border-b p-5">
        <div>
          <h2 className="font-display text-lg font-medium">{title}</h2>
          {description && <p className="text-ink-muted mt-1 text-sm">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="text-ink-muted hover:bg-paper-sunk hover:text-ink rounded-[var(--radius-sm)] p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="border-line-strong bg-surface text-ink hover:bg-paper-sunk h-9 rounded-[var(--radius-sm)] border px-4 text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "h-9 rounded-[var(--radius-sm)] px-4 text-sm font-medium text-white",
            danger ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-hover",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DailyCheckWithStatus } from "@/lib/data/daily-checks";

export interface CheckFormValues {
  title: string;
  description: string | null;
  emoji: string | null;
  colorToken: string;
  weekdays: number[];
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const COLOR_OPTIONS = [
  { value: "accent", label: "Terracota" },
  { value: "pine", label: "Verde" },
  { value: "ochre", label: "Ocre" },
  { value: "plum", label: "Ameixa" },
];

export function CheckFormDialog({
  open,
  onClose,
  onSubmit,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CheckFormValues) => Promise<void>;
  initialValues: DailyCheckWithStatus | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initialValues ? "Editar check diário" : "Novo check diário"}
    >
      {open && (
        <CheckForm
          key={initialValues?.id ?? "new"}
          onClose={onClose}
          onSubmit={onSubmit}
          initialValues={initialValues}
        />
      )}
    </Dialog>
  );
}

function CheckForm({
  onClose,
  onSubmit,
  initialValues,
}: {
  onClose: () => void;
  onSubmit: (values: CheckFormValues) => Promise<void>;
  initialValues: DailyCheckWithStatus | null;
}) {
  const [title, setTitle] = React.useState(initialValues?.title ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [emoji, setEmoji] = React.useState(initialValues?.emoji ?? "");
  const [colorToken, setColorToken] = React.useState(initialValues?.colorToken ?? "accent");
  const [weekdays, setWeekdays] = React.useState<number[]>(
    initialValues?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
  );
  const [saving, setSaving] = React.useState(false);

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (weekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title,
        description: description || null,
        emoji: emoji || null,
        colorToken,
        weekdays,
      });
      onClose();
    } catch {
      toast.error("Não foi possível salvar o check.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="w-20">
          <Label htmlFor="emoji">Emoji</Label>
          <Input
            id="emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="✅"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="color">Cor</Label>
          <Select id="color" value={colorToken} onChange={(e) => setColorToken(e.target.value)}>
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Dias da semana</Label>
        <div className="flex gap-1.5">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekday(day)}
              className={cn(
                "h-8 w-8 rounded-full text-xs font-medium transition-colors",
                weekdays.includes(day)
                  ? "bg-accent text-white"
                  : "bg-paper-sunk text-ink-muted hover:bg-line",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createTasksFromActionItems } from "@/lib/actions/meeting-action-items";
import type { ActionItem } from "@/lib/ai/action-items";

export type ActionItemView = ActionItem & { dueLabel: string | null };

const PRIORITY = {
  low: { label: "Baixa", tone: "neutral" },
  medium: { label: "Média", tone: "accent" },
  high: { label: "Alta", tone: "ochre" },
  urgent: { label: "Urgente", tone: "danger" },
} as const;

/**
 * A lista de próximos passos: marque os que viram tarefa, ajuste o título se
 * quiser e crie tudo de uma vez. Os que já viraram tarefa ficam travados.
 */
export function ActionItemsList({
  meetingId,
  items,
}: {
  meetingId: string;
  items: ActionItemView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  // Quem já virou tarefa não entra na seleção. Chaveado pelo id do item, então
  // gerar de novo (itens novos) não herda marcações de itens antigos.
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [titles, setTitles] = React.useState<Record<string, string>>({});

  const isSelected = (item: ActionItemView) => selected[item.id] ?? true;
  const titleOf = (item: ActionItemView) => titles[item.id] ?? item.title;

  const pendingItems = items.filter((item) => !item.taskId);
  const chosen = pendingItems.filter(isSelected).filter((item) => titleOf(item).trim() !== "");

  function handleCreate() {
    startTransition(async () => {
      const result = await createTasksFromActionItems(
        meetingId,
        chosen.map((item) => ({ id: item.id, title: titleOf(item) })),
      );
      if (result.ok) {
        toast.success(chosen.length === 1 ? "Tarefa criada." : `${chosen.length} tarefas criadas.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 p-4">
            {item.taskId ? (
              <CheckSquare checked size="sm" onChange={() => {}} aria-label="Tarefa já criada" />
            ) : (
              <CheckSquare
                checked={isSelected(item)}
                size="sm"
                onChange={(value) => setSelected((prev) => ({ ...prev, [item.id]: value }))}
                aria-label="Criar esta tarefa"
              />
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {item.taskId ? (
                <p className="text-ink-2 text-sm">{item.title}</p>
              ) : (
                <Input
                  value={titleOf(item)}
                  onChange={(event) =>
                    setTitles((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                  maxLength={300}
                  aria-label="Título da tarefa"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={PRIORITY[item.priority].tone}>{PRIORITY[item.priority].label}</Badge>
                {item.dueLabel && (
                  <span className="text-ink-muted flex items-center gap-1 text-xs">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {item.dueLabel}
                  </span>
                )}
                {item.taskId && (
                  <Link href="/tarefas" className="text-accent-ink text-xs hover:underline">
                    Tarefa criada — ver em Tarefas
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pendingItems.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleCreate} disabled={pending || chosen.length === 0}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending
              ? "Criando..."
              : chosen.length === 1
                ? "Criar 1 tarefa"
                : `Criar ${chosen.length} tarefas`}
          </Button>
        </div>
      )}
    </div>
  );
}

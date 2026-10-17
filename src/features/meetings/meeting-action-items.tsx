import { ActionItemsButton } from "@/features/meetings/action-items-button";
import { ActionItemsList } from "@/features/meetings/action-items-list";
import { formatDateKeyLabel } from "@/lib/date";
import type { MeetingDetail } from "@/lib/data/meetings";

/**
 * Os próximos passos da reunião como lista de tarefas para criar. Server
 * Component: os rótulos de data saem daqui, onde o fuso do app é conhecido. O
 * que está salvo abre sem chamar a OpenAI.
 */
export function MeetingActionItems({ meeting }: { meeting: MeetingDetail }) {
  const canGenerate = meeting.transcript !== null || meeting.recording !== null;
  const items = meeting.actionItems.map((item) => ({
    ...item,
    dueLabel: item.dueDate ? formatDateKeyLabel(item.dueDate) : null,
  }));
  const generated = meeting.actionItemsLabel !== null;

  return (
    <section className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Tarefas da reunião</p>
          {meeting.actionItemsLabel && (
            <p className="text-ink-muted mt-1 text-xs">Gerado em {meeting.actionItemsLabel}</p>
          )}
        </div>
        <ActionItemsButton meetingId={meeting.id} hasItems={generated} canGenerate={canGenerate} />
      </div>

      {items.length > 0 ? (
        <ActionItemsList meetingId={meeting.id} items={items} />
      ) : (
        <p className="text-ink-muted text-sm">
          {generated
            ? "A IA não encontrou nenhuma ação a fazer nessa reunião."
            : canGenerate
              ? "Clique em Gerar tarefas para a IA listar os próximos passos. Você escolhe quais viram tarefa."
              : "Envie ou grave um áudio para poder gerar as tarefas."}
        </p>
      )}
    </section>
  );
}

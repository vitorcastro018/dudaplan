import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { listChecksForDate } from "@/lib/data/daily-checks";
import { todayKey } from "@/lib/date";
import { ChecksBoard } from "@/features/daily-checks/checks-board";

export default async function ChecksPage() {
  const date = todayKey();
  const checks = await listChecksForDate(date);

  return (
    <div>
      <PageHeader
        title="Checks Diários"
        description="Tarefas recorrentes que precisam ser feitas todos os dias."
        actions={
          <LinkButton href="/checks/historico" variant="secondary">
            <History className="h-4 w-4" />
            Histórico
          </LinkButton>
        }
      />
      <ChecksBoard initialDate={date} initialChecks={checks} />
    </div>
  );
}

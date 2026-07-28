import { getTodayBoard } from "@/lib/data/tasks";
import { listProjectOptions } from "@/lib/data/projects";
import { formatDateKeyLabel } from "@/lib/date";
import { PageHeader } from "@/components/layout/page-header";
import { TodayBoard } from "@/features/today/today-board";

export const dynamic = "force-dynamic";

export default async function HojePage() {
  const [board, projects] = await Promise.all([getTodayBoard(), listProjectOptions()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hoje"
        description={capitalize(formatDateKeyLabel(board.today))}
      />
      <TodayBoard board={board} projects={projects} />
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

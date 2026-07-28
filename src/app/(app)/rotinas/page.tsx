import { PageHeader } from "@/components/layout/page-header";
import { getRoutineBoard } from "@/lib/data/routines";
import { formatDateKeyLabel } from "@/lib/date";
import { RoutineBoard } from "@/features/routines/routine-board";

export const dynamic = "force-dynamic";

export default async function RotinasPage() {
  const board = await getRoutineBoard();
  const label = formatDateKeyLabel(board.date);

  return (
    <div>
      <PageHeader
        title="Rotinas"
        description={label.charAt(0).toUpperCase() + label.slice(1)}
      />
      <RoutineBoard board={board} />
    </div>
  );
}

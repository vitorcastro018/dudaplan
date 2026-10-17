import { getTodayBoard } from "@/lib/data/tasks";
import { getRoutineBoard } from "@/lib/data/routines";
import { listMeetingsOnDay } from "@/lib/data/meetings";
import { listProjectOptions } from "@/lib/data/projects";
import { formatDateKeyLabel } from "@/lib/date";
import { PageHeader } from "@/components/layout/page-header";
import { TodayBoard } from "@/features/today/today-board";

export const dynamic = "force-dynamic";

export default async function HojePage() {
  const [board, projects] = await Promise.all([getTodayBoard(), listProjectOptions()]);
  // Depois do quadro de tarefas, e não junto: as rotinas e reuniões precisam do
  // mesmo `today` que ele usou, para a tela não misturar dois dias na virada
  // da meia-noite.
  const [routineBoard, meetings] = await Promise.all([
    getRoutineBoard(board.today),
    listMeetingsOnDay(board.today),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Hoje" description={capitalize(formatDateKeyLabel(board.today))} />
      <TodayBoard
        board={board}
        routines={routineBoard.routines}
        meetings={meetings}
        projects={projects}
      />
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

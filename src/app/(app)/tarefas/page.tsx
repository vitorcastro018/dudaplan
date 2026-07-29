import { PageHeader } from "@/components/layout/page-header";
import { listTasks } from "@/lib/data/tasks";
import { listProjectOptions } from "@/lib/data/projects";
import { TasksBoard } from "@/features/tasks/tasks-board";

export const dynamic = "force-dynamic";

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ projeto?: string }>;
}) {
  const { projeto } = await searchParams;

  // Em paralelo: uma consulta não depende da outra, e em série a página
  // esperaria a soma dos dois tempos de ida e volta sem motivo.
  const [tasks, projects] = await Promise.all([listTasks(projeto), listProjectOptions()]);

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Todas as tarefas do workspace. Cada uma pode pertencer a um projeto — ou ficar solta."
      />

      <TasksBoard tasks={tasks} projects={projects} activeFilter={projeto ?? ""} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import { listProjectTasks } from "@/lib/data/tasks";
import { TaskList } from "@/features/tasks/task-list";

export default async function ProjectTarefasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const tasks = await listProjectTasks(project.id);

  return (
    <TaskList
      projectId={project.id}
      initialTasks={tasks.map((task) => ({
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      }))}
    />
  );
}

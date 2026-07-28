import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getProject } from "@/lib/data/projects";
import { listProjectTasks } from "@/lib/data/tasks";
import { ProjectTasks } from "@/features/projects/project-tasks";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/features/projects/status";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // O RLS já devolve null para projeto de outro workspace, então "não achou" e
  // "não é seu" chegam aqui do mesmo jeito — que é exatamente o que se quer:
  // um 404 não revela que o recurso existe em outra conta.
  const project = await getProject(projectId);
  if (!project) notFound();

  const tasks = await listProjectTasks(project.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-ink text-3xl font-medium tracking-tight">
            {project.name}
          </h1>
          <Badge tone={PROJECT_STATUS_TONE[project.status]}>
            {PROJECT_STATUS_LABEL[project.status]}
          </Badge>
        </div>

        <p className="text-ink-2 mt-3 max-w-2xl text-sm">
          <span className="section-label mr-2">Resultado esperado</span>
          {project.outcome}
        </p>

        {(project.start_date || project.due_date) && (
          <p className="text-ink-muted mt-2 font-mono text-xs tabular-nums">
            {project.start_date && `início ${project.start_date}`}
            {project.start_date && project.due_date && "  ·  "}
            {project.due_date && `prazo ${project.due_date}`}
          </p>
        )}
      </div>

      <ProjectTasks projectId={project.id} tasks={tasks} />
    </div>
  );
}

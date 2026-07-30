import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getProject, listProjectOptions } from "@/lib/data/projects";
import { listProjectTasks } from "@/lib/data/tasks";
import { listProjectMeetings } from "@/lib/data/meetings";
import { ProjectTasks } from "@/features/projects/project-tasks";
import { ProjectMeetings } from "@/features/projects/project-meetings";
import { ProjectActions } from "@/features/projects/project-actions";
import { ProjectDeadlines } from "@/features/projects/project-deadlines";
import { projectBaseline } from "@/features/projects/deadlines";
import { formatDateKeyShort } from "@/lib/date-keys";
import { utcIsoToLocalDateTimeInput } from "@/lib/date";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/features/projects/status";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  // Tudo numa tacada só, em vez de buscar o projeto e só então as listas: as
  // listas usam o `projectId` da URL, não o resultado de `getProject`, então
  // encadeá-las só somava um round-trip inteiro ao banco — caro quando o banco
  // está longe. Se o projeto não existe, o `notFound()` abaixo descarta o resto.
  //
  // O RLS já devolve null para projeto de outro workspace, então "não achou" e
  // "não é seu" chegam do mesmo jeito — um 404 não revela que o recurso existe
  // em outra conta.
  const [project, tasks, meetings, projects] = await Promise.all([
    getProject(projectId),
    listProjectTasks(projectId),
    listProjectMeetings(projectId),
    listProjectOptions(),
  ]);
  if (!project) notFound();

  // Sugestão de data/hora calculada no servidor, para respeitar o APP_TIMEZONE
  // em vez do fuso do navegador — igual à tela /reunioes.
  const now = utcIsoToLocalDateTimeInput(new Date().toISOString());

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-ink text-3xl font-medium tracking-tight">
            {project.name}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={PROJECT_STATUS_TONE[project.status]}>
              {PROJECT_STATUS_LABEL[project.status]}
            </Badge>
            <ProjectActions project={project} />
          </div>
        </div>

        <div className="mt-4 grid max-w-4xl gap-4 sm:grid-cols-2">
          <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-4">
            <p className="section-label mb-2">Problema a ser resolvido</p>
            <p className="text-ink-2 text-sm">{project.problem}</p>
          </div>

          <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-4">
            <p className="section-label mb-2">Resultado esperado</p>
            <p className="text-ink-2 text-sm">{project.outcome}</p>
          </div>
        </div>

        <div className="border-line bg-surface mt-4 max-w-4xl rounded-[var(--radius-lg)] border p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="section-label">Prazos</p>
            <p className="text-ink-muted font-mono text-xs tabular-nums">
              início {formatDateKeyShort(projectBaseline(project))}
              {!project.start_date && " (criação)"}
            </p>
          </div>
          <ProjectDeadlines project={project} />
        </div>
      </div>

      <ProjectTasks projectId={project.id} tasks={tasks} projects={projects} />

      <ProjectMeetings
        projectId={project.id}
        meetings={meetings}
        projects={projects}
        defaultScheduledAt={now}
      />
    </div>
  );
}

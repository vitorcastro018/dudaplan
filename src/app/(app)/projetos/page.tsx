import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listProjects } from "@/lib/data/projects";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { ProjectDeadlines } from "@/features/projects/project-deadlines";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/features/projects/status";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const projects = await listProjects();

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Cada projeto declara o problema que resolve, como se sabe que terminou e três prazos."
        actions={<NewProjectDialog />}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto ainda"
          description="Crie o primeiro projeto para começar a pendurar tarefas nele."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projetos/${project.id}`}
              className="border-line bg-surface hover:border-line-strong flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-ink text-lg font-medium tracking-tight">
                  {project.name}
                </h2>
                <Badge tone={PROJECT_STATUS_TONE[project.status]}>
                  {PROJECT_STATUS_LABEL[project.status]}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-ink-muted line-clamp-2 text-sm">
                  <span className="section-label mr-1.5">Problema</span>
                  {project.problem}
                </p>
                <p className="text-ink-muted line-clamp-2 text-sm">
                  <span className="section-label mr-1.5">Resultado</span>
                  {project.outcome}
                </p>
              </div>

              <ProjectDeadlines project={project} className="border-line mt-auto border-t pt-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import { ProjectTabs } from "@/features/projects/project-tabs";
import { ProjectHeaderActions } from "@/features/projects/project-header-actions";

function toDateInputValue(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-ink text-3xl font-medium tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-ink-muted mt-1.5 max-w-2xl text-sm">{project.description}</p>
          )}
          {(project.startDate || project.dueDate) && (
            <p className="text-ink-muted mt-2 font-mono text-xs">
              {project.startDate && `Início: ${toDateInputValue(project.startDate)}`}
              {project.startDate && project.dueDate && "  ·  "}
              {project.dueDate && `Prazo: ${toDateInputValue(project.dueDate)}`}
            </p>
          )}
        </div>
        <ProjectHeaderActions
          project={{
            id: project.id,
            slug: project.slug,
            name: project.name,
            description: project.description,
            status: project.status,
            colorToken: project.colorToken,
            startDate: toDateInputValue(project.startDate),
            dueDate: toDateInputValue(project.dueDate),
          }}
        />
      </div>

      <div className="mb-8">
        <ProjectTabs slug={project.slug} />
      </div>

      {children}
    </div>
  );
}

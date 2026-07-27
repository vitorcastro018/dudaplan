import { PageHeader } from "@/components/layout/page-header";
import { listProjects } from "@/lib/data/projects";
import { ProjectGrid } from "@/features/projects/project-grid";

export default async function ProjetosPage() {
  const projects = await listProjects();

  return (
    <div>
      <PageHeader title="Projetos" description="Organize projetos, tarefas, notas e reuniões." />
      <ProjectGrid projects={projects} />
    </div>
  );
}

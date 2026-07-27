"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectFormDialog, type ProjectFormValues } from "./project-form-dialog";
import { ProjectCard, type ProjectCardData } from "./project-card";

export function ProjectGrid({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  async function handleCreate(values: ProjectFormValues) {
    const project = await apiRequest<{ slug: string }>("/api/projects", "POST", values);
    toast.success("Projeto criado.");
    router.push(`/projetos/${project.slug}`);
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo projeto
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto para organizar tarefas, notas e reuniões."
          action={<Button onClick={() => setDialogOpen(true)}>Novo projeto</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        initialValues={null}
      />
    </div>
  );
}

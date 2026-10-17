import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getClient } from "@/lib/data/clients";
import { listProjectOptions, listProjects } from "@/lib/data/projects";
import { listClientTasks } from "@/lib/data/tasks";
import { listClientMeetings } from "@/lib/data/meetings";
import { utcIsoToLocalDateTimeInput } from "@/lib/date";
import { ClientActions } from "@/features/clients/client-actions";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { ProjectDeadlines } from "@/features/projects/project-deadlines";
import { ProjectTasks } from "@/features/projects/project-tasks";
import { ProjectMeetings } from "@/features/projects/project-meetings";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/features/projects/status";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  // `getClient` filtra por usuário: cliente de outra conta e cliente inexistente
  // dão o mesmo 404, que não revela que o recurso existe em outra conta.
  const client = await getClient(clientId);
  if (!client) notFound();

  const [projects, tasks, meetings, projectOptions] = await Promise.all([
    listProjects(undefined, client.id),
    listClientTasks(client.id),
    listClientMeetings(client.id),
    listProjectOptions(),
  ]);

  // Sugestão de data/hora calculada no servidor, para respeitar o APP_TIMEZONE.
  const now = utcIsoToLocalDateTimeInput(new Date().toISOString());

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/clientes"
          className="text-ink-muted hover:text-ink mb-3 inline-flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Clientes
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="bg-accent-soft text-accent-hover font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-medium">
              {client.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-ink truncate text-3xl font-medium tracking-tight">
                {client.name}
              </h1>
              {client.contact && (
                <p className="text-ink-muted mt-1 flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {client.contact}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ClientActions client={client} />
          </div>
        </div>

        {client.description && (
          <div className="border-line bg-surface mt-4 max-w-4xl rounded-[var(--radius-lg)] border p-4">
            <p className="section-label mb-2">Sobre o cliente</p>
            <p className="text-ink-2 text-sm whitespace-pre-line">{client.description}</p>
          </div>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-ink text-lg font-medium tracking-tight">Projetos</h2>
          <NewProjectDialog defaultClientId={client.id} />
        </div>

        {projects.length === 0 ? (
          <EmptyState title="Sem projetos" description="Crie o primeiro projeto deste cliente." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projetos/${project.id}`}
                className="border-line bg-surface hover:border-line-strong flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-ink text-base font-medium tracking-tight">
                    {project.name}
                  </h3>
                  <Badge tone={PROJECT_STATUS_TONE[project.status]}>
                    {PROJECT_STATUS_LABEL[project.status]}
                  </Badge>
                </div>
                <p className="text-ink-muted line-clamp-2 text-sm">{project.problem}</p>
                <ProjectDeadlines project={project} className="border-line mt-auto border-t pt-3" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <ProjectTasks
        clientId={client.id}
        tasks={tasks}
        projects={projectOptions}
        placeholder="Nova tarefa deste cliente"
        emptyDescription="Adicione a primeira tarefa deste cliente."
      />

      <ProjectMeetings
        clientId={client.id}
        meetings={meetings}
        projects={projectOptions}
        defaultScheduledAt={now}
        emptyDescription="Registre a primeira reunião deste cliente."
      />
    </div>
  );
}

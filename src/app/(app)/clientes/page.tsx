import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listClients } from "@/lib/data/clients";
import { NewClientButton } from "@/features/clients/new-client-button";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clients = await listClients();

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cada cliente reúne os projetos, tarefas e reuniões dele."
        actions={<NewClientButton />}
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum cliente ainda"
          description="Crie o primeiro cliente para pendurar projetos, tarefas e reuniões nele."
          action={<NewClientButton />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clientes/${client.id}`}
              className="border-line bg-surface hover:border-line-strong flex flex-col gap-4 rounded-[var(--radius-lg)] border p-5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="bg-accent-soft text-accent-hover font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-medium">
                  {client.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-ink truncate text-lg font-medium tracking-tight">
                    {client.name}
                  </h2>
                  {client.contact && (
                    <p className="text-ink-muted truncate text-xs">{client.contact}</p>
                  )}
                </div>
              </div>

              {client.description && (
                <p className="text-ink-muted line-clamp-2 text-sm">{client.description}</p>
              )}

              <dl className="border-line mt-auto grid grid-cols-3 gap-2 border-t pt-3">
                <Count label="Projetos" value={client.activeProjects} />
                <Count label="Tarefas" value={client.openTasks} />
                <Count label="Reuniões" value={client.meetings} />
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="font-display text-ink text-xl font-medium tabular-nums">{value}</dd>
      <dt className="text-ink-muted text-xs">{label}</dt>
    </div>
  );
}

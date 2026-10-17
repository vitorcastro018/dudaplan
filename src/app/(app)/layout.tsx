import { requireUser } from "@/lib/session";
import { listProjectOptions } from "@/lib/data/projects";
import { listClientOptions } from "@/lib/data/clients";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `requireUser` manda para o login quem não tem sessão. Em paralelo com a
  // lista da barra lateral: uma não depende do retorno da outra, e as duas só
  // precisam do cookie da sessão, que já está presente. Encadeá-las somava os
  // dois tempos de banco a cada troca de página, à toa.
  const [, projects, clients] = await Promise.all([
    requireUser(),
    listProjectOptions(),
    listClientOptions(),
  ]);

  return (
    <AppShell projects={projects} clients={clients}>
      {children}
    </AppShell>
  );
}

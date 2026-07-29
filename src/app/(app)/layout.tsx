import { requireContext } from "@/lib/workspace";
import { listProjectOptions } from "@/lib/data/projects";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `requireContext` garante que a conta tem workspace — sem isso o RLS esconde
  // tudo e as telas abririam vazias sem explicação nenhuma. Em paralelo com a
  // lista da barra lateral: uma não depende do retorno da outra, e as duas só
  // precisam do cookie da sessão, que já está presente. Encadeá-las somava os
  // dois tempos de banco a cada troca de página, à toa.
  const [, projects] = await Promise.all([requireContext(), listProjectOptions()]);

  return <AppShell projects={projects}>{children}</AppShell>;
}

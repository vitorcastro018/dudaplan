import { requireContext } from "@/lib/workspace";
import { listProjectOptions } from "@/lib/data/projects";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Também garante que a conta tem workspace — sem isso o RLS esconde tudo e as
  // telas abririam vazias sem explicação nenhuma.
  await requireContext();
  const projects = await listProjectOptions();

  return <AppShell projects={projects}>{children}</AppShell>;
}

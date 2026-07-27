import { requireSession } from "@/lib/auth/guard";
import { listSidebarProjects } from "@/lib/data/projects";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const projects = await listSidebarProjects();

  return <AppShell projects={projects}>{children}</AppShell>;
}

import { Sidebar, type SidebarProject } from "./sidebar";

export function AppShell({
  projects,
  children,
}: {
  projects: SidebarProject[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar projects={projects} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1080px] px-8 py-10">{children}</div>
      </main>
    </div>
  );
}

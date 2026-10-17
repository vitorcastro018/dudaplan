import { Sidebar, type SidebarProject } from "./sidebar";
import { ClientOptionsProvider, type ClientOption } from "./client-options";

export function AppShell({
  projects,
  clients,
  children,
}: {
  projects: SidebarProject[];
  clients: ClientOption[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar projects={projects} />
      <main className="flex-1 overflow-x-hidden">
        <ClientOptionsProvider clients={clients}>
          <div className="mx-auto max-w-[1080px] px-8 py-10">{children}</div>
        </ClientOptionsProvider>
      </main>
    </div>
  );
}

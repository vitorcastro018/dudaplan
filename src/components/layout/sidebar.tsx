"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, FolderKanban, ListChecks, LogOut, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

export interface SidebarProject {
  id: string;
  name: string;
}

export function Sidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <aside className="border-line bg-paper-sunk sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="bg-accent flex h-6 w-6 items-center justify-center rounded-[6px]">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-white" />
        </span>
        <span className="font-display text-ink text-lg font-semibold tracking-tight">DudaPlan</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        <NavLink
          href="/hoje"
          icon={CalendarCheck}
          label="Hoje"
          active={pathname.startsWith("/hoje")}
        />
        <NavLink
          href="/rotinas"
          icon={Repeat}
          label="Rotinas"
          active={pathname.startsWith("/rotinas")}
        />
        <NavLink
          href="/projetos"
          icon={FolderKanban}
          label="Projetos"
          active={pathname === "/projetos"}
        />

        {projects.length > 0 && (
          <div className="my-2 flex flex-col gap-0.5 pl-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projetos/${project.id}`}
                className={cn(
                  "text-ink-muted hover:bg-surface hover:text-ink truncate rounded-[var(--radius-sm)] px-3 py-1.5 text-sm",
                  pathname === `/projetos/${project.id}` && "bg-surface text-ink",
                )}
              >
                {project.name}
              </Link>
            ))}
          </div>
        )}

        <NavLink
          href="/tarefas"
          icon={ListChecks}
          label="Tarefas"
          active={pathname.startsWith("/tarefas")}
        />
      </nav>

      <div className="border-line flex items-center justify-between border-t px-5 py-4">
        <span className="text-ink-muted font-mono text-xs tabular-nums">{today}</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-ink-muted hover:text-ink flex items-center gap-1.5 text-xs font-medium"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-ink-2 hover:bg-surface hover:text-ink flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors",
        active &&
          "bg-surface text-ink before:bg-accent relative before:absolute before:top-1/2 before:-left-3 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

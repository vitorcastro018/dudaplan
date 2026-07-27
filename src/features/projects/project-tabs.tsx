"use client";

import { usePathname } from "next/navigation";
import { UnderlineTabs } from "@/components/ui/tabs";

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/projetos/${slug}`;

  const items = [
    { label: "Visão geral", href: base, active: pathname === base },
    { label: "Tarefas", href: `${base}/tarefas`, active: pathname.startsWith(`${base}/tarefas`) },
    { label: "Notas", href: `${base}/notas`, active: pathname.startsWith(`${base}/notas`) },
    {
      label: "Reuniões",
      href: `${base}/reunioes`,
      active: pathname.startsWith(`${base}/reunioes`),
    },
  ];

  return <UnderlineTabs items={items} />;
}

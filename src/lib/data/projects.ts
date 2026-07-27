import { prisma } from "@/lib/prisma";

export function listSidebarProjects() {
  return prisma.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { position: "asc" },
    select: { id: true, name: true, slug: true },
    take: 8,
  });
}

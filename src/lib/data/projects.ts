import { cache } from "react";
import { prisma } from "@/lib/prisma";

export function listSidebarProjects() {
  return prisma.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { position: "asc" },
    select: { id: true, name: true, slug: true },
    take: 8,
  });
}

export async function listProjects(status?: string) {
  const projects = await prisma.project.findMany({
    where: status ? { status: status as never } : {},
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { notes: true, tasks: true, meetings: true } },
    },
  });
  return projects;
}

export const getProjectBySlug = cache(async (slug: string) => {
  return prisma.project.findUnique({
    where: { slug },
    include: {
      _count: { select: { notes: true, tasks: true, meetings: true } },
    },
  });
});

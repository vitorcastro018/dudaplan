import { prisma } from "@/lib/prisma";

export function listProjectNotes(projectId: string) {
  return prisma.projectNote.findMany({
    where: { projectId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });
}

import { prisma } from "@/lib/prisma";

export function listProjectTasks(projectId: string) {
  return prisma.projectTask.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}

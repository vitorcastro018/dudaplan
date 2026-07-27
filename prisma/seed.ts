import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.dailyCheck.createMany({
    data: [
      { title: "Revisar e-mails", emoji: "📧", colorToken: "accent", position: 0 },
      { title: "Planejar o dia", emoji: "🗒️", colorToken: "pine", position: 1 },
      { title: "Atualizar quadro de tarefas", emoji: "✅", colorToken: "ochre", position: 2 },
    ],
    skipDuplicates: true,
  });

  const project = await prisma.project.upsert({
    where: { slug: "projeto-exemplo" },
    update: {},
    create: {
      name: "Projeto Exemplo",
      slug: "projeto-exemplo",
      description: "Projeto de demonstração criado pelo seed inicial do DudaPlan.",
      status: "ACTIVE",
    },
  });

  await prisma.projectNote.create({
    data: {
      projectId: project.id,
      title: "Bem-vindo",
      content:
        "# Bem-vindo ao DudaPlan\n\nEssa é uma nota de exemplo. Use markdown para registrar informações relevantes do projeto.",
      isPinned: true,
    },
  });

  await prisma.projectTask.createMany({
    data: [
      {
        projectId: project.id,
        title: "Definir escopo inicial",
        status: "DONE",
        priority: "HIGH",
        position: 0,
      },
      {
        projectId: project.id,
        title: "Marcar reunião de kickoff",
        status: "TODO",
        priority: "MEDIUM",
        position: 1,
      },
    ],
  });

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/guard";
import { listProjects } from "@/lib/data/projects";
import { createProjectSchema } from "@/lib/validation/projects";
import { slugify } from "@/lib/utils";
import { ok, unauthorized, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();

    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const projects = await listProjects(status ?? undefined);
    return ok(projects);
  } catch (error) {
    return handleApiError(error);
  }
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "projeto";
  let slug = base;
  let suffix = 2;

  while (await prisma.project.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();

    const body = createProjectSchema.parse(await request.json());
    const slug = await generateUniqueSlug(body.name);

    const last = await prisma.project.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const project = await prisma.project.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        colorToken: body.colorToken,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        position: (last?.position ?? -1) + 1,
      },
    });

    return ok(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

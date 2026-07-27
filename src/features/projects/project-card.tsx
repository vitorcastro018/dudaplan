import Link from "next/link";
import { StickyNote, ListTodo, Video } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "./status";

export interface ProjectCardData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  _count: { notes: number; tasks: number; meetings: number };
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link href={`/projetos/${project.slug}`} className="block">
      <Card className="hover:border-line-strong h-full transition-colors">
        <CardContent className="flex h-full flex-col">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="font-display text-ink text-lg font-medium">{project.name}</h3>
            <Badge tone={PROJECT_STATUS_TONE[project.status] ?? "neutral"}>
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </Badge>
          </div>
          {project.description && (
            <p className="text-ink-muted line-clamp-2 text-sm">{project.description}</p>
          )}
        </CardContent>
        <CardFooter>
          <span className="flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            {project._count.tasks} tarefas
          </span>
          <span className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            {project._count.notes} notas
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" />
            {project._count.meetings} reuniões
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

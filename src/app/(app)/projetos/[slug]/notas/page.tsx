import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import { listProjectNotes } from "@/lib/data/notes";
import { NoteList } from "@/features/notes/note-list";

export default async function ProjectNotasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const notes = await listProjectNotes(project.id);

  return (
    <NoteList
      projectId={project.id}
      initialNotes={notes.map((note) => ({ ...note, updatedAt: note.updatedAt.toISOString() }))}
    />
  );
}

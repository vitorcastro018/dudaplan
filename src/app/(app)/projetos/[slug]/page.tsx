import { getProjectBySlug } from "@/lib/data/projects";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
        <p className="section-label">Tarefas</p>
        <p className="font-display text-ink text-2xl font-medium">{project._count.tasks}</p>
      </div>
      <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
        <p className="section-label">Notas</p>
        <p className="font-display text-ink text-2xl font-medium">{project._count.notes}</p>
      </div>
      <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
        <p className="section-label">Reuniões</p>
        <p className="font-display text-ink text-2xl font-medium">{project._count.meetings}</p>
      </div>
    </div>
  );
}

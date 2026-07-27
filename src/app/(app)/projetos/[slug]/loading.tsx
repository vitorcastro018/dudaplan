import { Skeleton } from "@/components/ui/empty-state";

export default function ProjectDetailLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="mb-8 h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

import { SkeletonTable } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-9 w-64" />
      </div>
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}

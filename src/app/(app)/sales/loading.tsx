import { SkeletonStats, SkeletonTable } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalesLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <Skeleton className="mb-2 h-7 w-36" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="mb-6">
        <SkeletonStats count={3} />
      </div>
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <Skeleton className="mb-2 h-7 w-36" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[290px] shrink-0 rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-20 w-full rounded-[12px]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

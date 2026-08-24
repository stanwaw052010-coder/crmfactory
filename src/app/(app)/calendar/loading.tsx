import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="ml-auto h-8 w-52" />
      </div>
      <Skeleton className="mb-4 h-8 w-96" />
      <div className="card overflow-hidden">
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="w-16 shrink-0" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 border-l border-[var(--border)] px-2 py-3">
              <Skeleton className="mx-auto h-3 w-8" />
              <Skeleton className="mx-auto mt-2 h-5 w-6 rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-px p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

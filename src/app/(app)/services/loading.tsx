import { Skeleton } from "@/components/ui/skeleton";

export default function ServicesLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <Skeleton className="mb-2 h-7 w-36" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-24" />
            <Skeleton className="mt-5 h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

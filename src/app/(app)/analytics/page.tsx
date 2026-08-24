import type { Metadata } from "next";
import { Suspense } from "react";
import { requireViewPermission } from "@/lib/auth/context";
import { getAnalytics } from "@/server/queries/analytics";
import { RANGE_DAYS, type AnalyticsRange } from "@/lib/analytics-range";
import { PageHeader } from "@/components/shared/page-header";
import { SkeletonStats } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsView } from "@/features/analytics/analytics-view";

export const metadata: Metadata = { title: "Аналітика" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = typeof params.range === "string" ? params.range : "30d";
  const range = (Object.keys(RANGE_DAYS).includes(raw) ? raw : "30d") as AnalyticsRange;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Аналітика"
        description="Виручка, завантаження команди та поведінка клієнтів — без ручних звітів."
      />
      <Suspense key={range} fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent range={range} />
      </Suspense>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-72" />
      <SkeletonStats />
      <div className="card p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-[280px] w-full" />
      </div>
    </div>
  );
}

async function AnalyticsContent({ range }: { range: AnalyticsRange }) {
  const ctx = await requireViewPermission("analytics.view");
  const data = await getAnalytics(ctx.organization.id, range);
  return <AnalyticsView data={data} currency={ctx.organization.currency} />;
}

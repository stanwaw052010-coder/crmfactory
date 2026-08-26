import type { Metadata } from "next";
import { Suspense } from "react";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { getReviewSummary, listReviews } from "@/server/queries/reviews";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton, SkeletonStats } from "@/components/ui/skeleton";
import { ReviewsView } from "@/features/reviews/reviews-view";

export const metadata: Metadata = { title: "Відгуки" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ratingRaw = Number(typeof params.rating === "string" ? params.rating : "");
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
  const unansweredOnly = params.unanswered === "1";

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Відгуки"
        description="Що клієнти кажуть про візити — і чи почули ви тих, кому не сподобалося."
      />
      <Suspense key={`${rating}-${unansweredOnly}`} fallback={<ReviewsSkeleton />}>
        <ReviewsContent rating={rating} unansweredOnly={unansweredOnly} />
      </Suspense>
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonStats />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

async function ReviewsContent({
  rating,
  unansweredOnly,
}: {
  rating: number | null;
  unansweredOnly: boolean;
}) {
  const ctx = await requireViewPermission("review.view");
  // `reviewPublicUrl` немає в OrgSummary навмисно: той тип тонкий і їде
  // з кожним запитом застосунку. Заради однієї сторінки роздувати його
  // не варто — дешевше дочитати поле тут.
  const [summary, reviews, settings] = await Promise.all([
    getReviewSummary(ctx.organization.id),
    listReviews({ organizationId: ctx.organization.id, rating, unansweredOnly }),
    prisma.organization.findUnique({
      where: { id: ctx.organization.id },
      select: { reviewPublicUrl: true },
    }),
  ]);

  return (
    <ReviewsView
      summary={summary}
      reviews={reviews.map((review) => ({
        ...review,
        submittedAt: review.submittedAt.toISOString(),
        visitedAt: review.visitedAt.toISOString(),
        repliedAt: review.repliedAt?.toISOString() ?? null,
      }))}
      activeRating={rating}
      unansweredOnly={unansweredOnly}
      canManage={ctx.permissions.has("review.manage")}
      publicUrlConfigured={Boolean(settings?.reviewPublicUrl)}
    />
  );
}

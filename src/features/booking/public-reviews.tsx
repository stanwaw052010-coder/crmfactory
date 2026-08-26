"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn, pluralUk } from "@/lib/utils";

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  replyText: string | null;
  employeeName: string | null;
  author: string;
};

/**
 * Відгуки на сторінці салону.
 *
 * Показуємо лише ті, що салон сам опублікував: сторінка запису — вітрина,
 * а не відкрита стрічка. Автор підписаний як «Олена К.» — повне прізвище
 * на публічній сторінці людина, лишаючи відгук САЛОНУ, не очікує.
 *
 * Якщо опублікованих відгуків немає, блока немає взагалі: порожній розділ
 * «Відгуки» на сторінці салону працює гірше за його відсутність.
 */
export function PublicReviews({
  reviews,
  average,
  total,
}: {
  reviews: PublicReview[];
  average: number | null;
  total: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  if (reviews.length === 0) return null;

  const shown = expanded ? reviews : reviews.slice(0, 3);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg)]">Відгуки</h2>
        {average !== null && (
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)]">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-[var(--fg)]">{average.toFixed(1)}</span>
            <span>
              · {total} {pluralUk(total, "відгук", "відгуки", "відгуків")}
            </span>
          </p>
        )}
      </header>

      <div className="space-y-3">
        {shown.map((review) => (
          <article
            key={review.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-3.5 w-3.5",
                      star <= review.rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-[var(--border-strong)]",
                    )}
                  />
                ))}
              </span>
              <span className="text-[13px] font-medium text-[var(--fg)]">{review.author}</span>
              {review.employeeName && (
                <span className="text-[12.5px] text-[var(--fg-subtle)]">
                  · {review.employeeName}
                </span>
              )}
            </div>

            {review.comment && (
              <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[var(--fg)]">
                {review.comment}
              </p>
            )}

            {review.replyText && (
              <div className="mt-3 border-l-2 border-[var(--primary)] pl-3">
                <p className="text-[12px] text-[var(--fg-subtle)]">Відповідь салону</p>
                <p className="mt-0.5 text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--fg-muted)]">
                  {review.replyText}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      {reviews.length > 3 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-xl border border-[var(--border)] py-2.5 text-[13.5px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          Показати всі {reviews.length}
        </button>
      )}
    </section>
  );
}

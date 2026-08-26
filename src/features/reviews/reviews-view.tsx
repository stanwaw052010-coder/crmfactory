"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, MessageSquare, Star } from "lucide-react";
import { cn, pluralUk } from "@/lib/utils";
import type { ReviewSummary } from "@/server/queries/reviews";
import { replyToReviewAction, toggleReviewPublicAction } from "@/server/actions/reviews";

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  visitedAt: string;
  isPublic: boolean;
  replyText: string | null;
  repliedAt: string | null;
  clientId: string;
  clientName: string;
  employeeName: string | null;
  serviceName: string;
};

/** Від чотирьох зірок вважаємо відгук хорошим — так само, як на формі клієнта. */
const HAPPY_FROM = 4;

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} з 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          style={{ width: size, height: size }}
          className={star <= value ? "fill-amber-400 text-amber-400" : "text-[var(--border-strong)]"}
        />
      ))}
    </span>
  );
}

export function ReviewsView(props: {
  summary: ReviewSummary;
  reviews: ReviewItem[];
  activeRating: number | null;
  unansweredOnly: boolean;
  canManage: boolean;
  publicUrlConfigured: boolean;
}) {
  const { summary } = props;
  const maxInDistribution = Math.max(...summary.distribution, 1);

  return (
    <div className="space-y-6">
      {/* Головні числа. Конверсія тут важливіша за середню оцінку:
          середня оцінка при трьох відгуках нічого не означає, а частка
          відповідей одразу каже, чи працює механіка взагалі. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Середня оцінка"
          value={summary.average !== null ? summary.average.toFixed(1) : "—"}
          hint={
            summary.answered > 0
              ? `${summary.answered} ${pluralUk(summary.answered, "відгук", "відгуки", "відгуків")}`
              : "ще немає"
          }
        />
        <Stat
          label="Відповіли"
          value={summary.responseRate !== null ? `${summary.responseRate}%` : "—"}
          hint={
            summary.requested > 0
              ? `${summary.answered} з ${summary.requested} запитів`
              : "запитів ще не було"
          }
        />
        <Stat
          label="Без відповіді салону"
          value={String(summary.awaitingReply)}
          hint={summary.awaitingReply > 0 ? "потребують уваги" : "усі опрацьовані"}
          tone={summary.awaitingReply > 0 ? "warning" : "default"}
        />
        <Stat
          label="Опубліковано"
          value={String(summary.published)}
          hint="видно на сторінці салону"
        />
      </div>

      {summary.answered > 0 && (
        <div className="card space-y-2 p-5">
          <p className="text-[13px] font-medium text-[var(--fg)]">Розподіл оцінок</p>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star - 1];
            return (
              <button
                key={star}
                type="button"
                onClick={() => go({ rating: props.activeRating === star ? null : star })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--surface-2)]",
                  props.activeRating === star && "bg-[var(--surface-2)]",
                )}
              >
                <span className="w-8 shrink-0 text-right text-[12.5px] tabular-nums text-[var(--fg-muted)]">
                  {star}★
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <span
                    className={cn(
                      "block h-full rounded-full transition-[width] duration-500",
                      star >= HAPPY_FROM ? "bg-amber-400" : "bg-[var(--danger)]",
                    )}
                    style={{ width: `${(count / maxInDistribution) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-[12.5px] tabular-nums text-[var(--fg-muted)]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!props.publicUrlConfigured && summary.answered > 0 && (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-[var(--warning-soft)] px-4 py-3">
          <p className="text-[13px] leading-relaxed text-[var(--warning)]">
            Задоволеним клієнтам нема куди вести: у налаштуваннях не вказано посилання
            на публічну сторінку салону (Google Карти, Facebook). Без нього відгуки
            лишаються тільки всередині CRM і не приводять нових клієнтів.{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Додати посилання
            </Link>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Filter active={props.activeRating === null && !props.unansweredOnly} onClick={() => go({ rating: null, unanswered: false })}>
          Усі
        </Filter>
        <Filter active={props.unansweredOnly} onClick={() => go({ unanswered: !props.unansweredOnly })}>
          Без відповіді
        </Filter>
        {props.activeRating !== null && (
          <Filter active onClick={() => go({ rating: null })}>
            {props.activeRating}★ — скинути
          </Filter>
        )}
      </div>

      {props.reviews.length === 0 ? (
        <EmptyReviews requested={summary.requested} />
      ) : (
        <div className="space-y-3">
          {props.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} canManage={props.canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function go(patch: { rating?: number | null; unanswered?: boolean }) {
  const url = new URL(window.location.href);
  if ("rating" in patch) {
    if (patch.rating === null) url.searchParams.delete("rating");
    else url.searchParams.set("rating", String(patch.rating));
  }
  if ("unanswered" in patch) {
    if (patch.unanswered) url.searchParams.set("unanswered", "1");
    else url.searchParams.delete("unanswered");
  }
  window.location.href = url.toString();
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="card p-4">
      <p className="text-[12px] text-[var(--fg-subtle)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums",
          tone === "warning" ? "text-[var(--warning)]" : "text-[var(--fg)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-[var(--fg-muted)]">{hint}</p>
    </div>
  );
}

function Filter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
          : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </button>
  );
}

function EmptyReviews({ requested }: { requested: number }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <MessageSquare className="h-8 w-8 text-[var(--fg-subtle)]" />
      <p className="text-[14px] font-medium text-[var(--fg)]">Відгуків поки немає</p>
      <p className="max-w-[420px] text-[13px] leading-relaxed text-[var(--fg-muted)]">
        {requested > 0
          ? "Запити надіслано — тепер справа за клієнтами. Зазвичай відповідають протягом доби."
          : "Запит іде клієнту на пошту через кілька годин після візиту, позначеного завершеним. Щоб він пішов, у картці клієнта має бути email."}
      </p>
    </div>
  );
}

function ReviewCard({ review, canManage }: { review: ReviewItem; canManage: boolean }) {
  const router = useRouter();
  const [reply, setReply] = React.useState(review.replyText ?? "");
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(review.isPublic);

  const happy = review.rating >= HAPPY_FROM;
  const when = React.useMemo(
    () =>
      new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(
        new Date(review.submittedAt),
      ),
    [review.submittedAt],
  );

  async function sendReply() {
    setPending(true);
    const result = await replyToReviewAction({ id: review.id, text: reply });
    setPending(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  async function togglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    const result = await toggleReviewPublicAction({ id: review.id, isPublic: next });
    if (!result.ok) setIsPublic(!next);
    else router.refresh();
  }

  return (
    <article
      className={cn(
        "card space-y-3 p-5",
        // Низька оцінка без відповіді — єдине, що має кидатися в очі
        // на цій сторінці: саме через неї клієнти йдуть мовчки.
        !happy && !review.replyText && "border-[color-mix(in_oklab,var(--danger)_35%,transparent)]",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Stars value={review.rating} />
            <Link
              href={`/clients/${review.clientId}`}
              className="truncate text-[14px] font-medium text-[var(--fg)] hover:underline"
            >
              {review.clientName}
            </Link>
          </div>
          <p className="text-[12.5px] text-[var(--fg-muted)]">
            {review.serviceName}
            {review.employeeName ? ` · ${review.employeeName}` : ""} · {when}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => void togglePublic()}
            title={isPublic ? "Прибрати зі сторінки салону" : "Показати на сторінці салону"}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors",
              isPublic
                ? "border-[var(--success)] text-[var(--success)]"
                : "border-[var(--border)] text-[var(--fg-subtle)] hover:bg-[var(--surface-2)]",
            )}
          >
            {isPublic ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {isPublic ? "Опубліковано" : "Не показується"}
          </button>
        )}
      </header>

      {review.comment && (
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-[var(--fg)]">
          {review.comment}
        </p>
      )}

      {review.replyText && !open && (
        <div className="rounded-xl border-l-2 border-[var(--primary)] bg-[var(--surface-2)] px-3.5 py-2.5">
          <p className="text-[12px] text-[var(--fg-subtle)]">Ваша відповідь</p>
          <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[var(--fg)]">
            {review.replyText}
          </p>
        </div>
      )}

      {canManage && (
        open ? (
          <div className="space-y-2">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder={
                happy
                  ? "Подякуйте — це видно на сторінці салону, якщо відгук опубліковано"
                  : "Що ви зробили, щоб це не повторилося"
              }
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14px] text-[var(--fg)] outline-none focus:border-[var(--primary)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void sendReply()}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Зберегти
              </button>
              <button
                type="button"
                onClick={() => {
                  setReply(review.replyText ?? "");
                  setOpen(false);
                }}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-[13px] text-[var(--fg-muted)]"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] font-medium text-[var(--primary)] hover:underline"
          >
            {review.replyText ? "Змінити відповідь" : "Відповісти"}
          </button>
        )
      )}
    </article>
  );
}

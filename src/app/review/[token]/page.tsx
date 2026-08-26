import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findReviewByToken } from "@/lib/reviews";
import { ReviewForm } from "@/features/reviews/review-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оцініть візит",
  // Сторінка приватна за суттю: посилання знає лише той, кому надіслали лист.
  robots: { index: false, follow: false },
};

/**
 * Сторінка відгуку. Відкривається за посиланням із листа.
 *
 * Доступ — за знанням токена, як і у файлі календаря. Тому тут немає
 * нічого, чого клієнт і так не знає про власний візит: салон, послуга,
 * майстер, дата. Ані телефону, ані суми, ані чужих імен.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const invite = await findReviewByToken(token);
  if (!invite) notFound();

  // Оцінка з листа: людина вже натиснула зірку, форма має відкритися саме з нею.
  const fromEmail = Number(query.r);
  const preset =
    Number.isInteger(fromEmail) && fromEmail >= 1 && fromEmail <= 5 ? fromEmail : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <ReviewForm
        token={token}
        businessName={invite.businessName}
        service={invite.service}
        employee={invite.employee}
        visitedAt={invite.visitedAt.toISOString()}
        publicUrl={invite.publicUrl}
        initialRating={invite.rating ?? preset}
        initialComment={invite.comment}
        alreadySubmitted={invite.submittedAt !== null}
      />
    </main>
  );
}

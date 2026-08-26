import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Відгуки очима салону.
 *
 * Тут же рахується те, заради чого власник взагалі відкриє цю сторінку:
 * скільки просили, скільки відповіли й що з цього публічне. Без цих
 * чисел список відгуків — просто стрічка, за якою не видно, працює
 * механіка чи ні.
 */

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: Date;
  isPublic: boolean;
  replyText: string | null;
  repliedAt: Date | null;
  clientName: string;
  clientId: string;
  employeeName: string | null;
  serviceName: string;
  visitedAt: Date;
};

export type ReviewSummary = {
  /** Скільки запитів надіслано — знаменник конверсії. */
  requested: number;
  /** Скільки відповіли. */
  answered: number;
  /** Частка тих, хто відповів, 0..100. Null, якщо ще нікого не питали. */
  responseRate: number | null;
  /** Середня оцінка. Null, поки немає жодної. */
  average: number | null;
  /** Скільки відгуків кожної оцінки: [1★, 2★, 3★, 4★, 5★]. */
  distribution: number[];
  /** Скільки чекають на відповідь салону. */
  awaitingReply: number;
  published: number;
};

export async function getReviewSummary(organizationId: string): Promise<ReviewSummary> {
  const [requested, byRating, awaitingReply, published] = await Promise.all([
    prisma.review.count({ where: { organizationId, requestedAt: { not: null } } }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { organizationId, rating: { not: null } },
      _count: { _all: true },
    }),
    // Низька оцінка без відповіді — те, що має пекти. Висока без відповіді
    // теж варта уваги, але не так терміново, тож рахуємо все непрочитане.
    prisma.review.count({
      where: { organizationId, submittedAt: { not: null }, repliedAt: null },
    }),
    prisma.review.count({ where: { organizationId, isPublic: true } }),
  ]);

  const distribution = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;

  for (const row of byRating) {
    if (row.rating === null) continue;
    const count = row._count._all;
    distribution[row.rating - 1] = count;
    total += count;
    sum += row.rating * count;
  }

  return {
    requested,
    answered: total,
    responseRate: requested > 0 ? Math.round((total / requested) * 100) : null,
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
    distribution,
    awaitingReply,
    published,
  };
}

export async function listReviews(params: {
  organizationId: string;
  /** Показати лише з цією оцінкою. */
  rating?: number | null;
  /** Лише ті, на які салон ще не відповів. */
  unansweredOnly?: boolean;
  limit?: number;
}): Promise<ReviewRow[]> {
  const rows = await prisma.review.findMany({
    where: {
      organizationId: params.organizationId,
      submittedAt: { not: null },
      ...(params.rating ? { rating: params.rating } : {}),
      ...(params.unansweredOnly ? { repliedAt: null } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: params.limit ?? 100,
    select: {
      id: true,
      rating: true,
      comment: true,
      submittedAt: true,
      isPublic: true,
      replyText: true,
      repliedAt: true,
      client: { select: { id: true, firstName: true, lastName: true } },
      employee: { select: { name: true } },
      appointment: { select: { startAt: true, service: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating ?? 0,
    comment: row.comment,
    submittedAt: row.submittedAt!,
    isPublic: row.isPublic,
    replyText: row.replyText,
    repliedAt: row.repliedAt,
    clientId: row.client.id,
    clientName: [row.client.firstName, row.client.lastName].filter(Boolean).join(" "),
    employeeName: row.employee?.name ?? null,
    serviceName: row.appointment.service.name,
    visitedAt: row.appointment.startAt,
  }));
}

/** Опубліковані відгуки для сторінки салону. Без імен по батькові й прізвищ. */
export async function listPublicReviews(organizationId: string, limit = 12) {
  const rows = await prisma.review.findMany({
    where: { organizationId, isPublic: true, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: {
      id: true,
      rating: true,
      comment: true,
      submittedAt: true,
      replyText: true,
      client: { select: { firstName: true, lastName: true } },
      employee: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating ?? 0,
    comment: row.comment,
    submittedAt: row.submittedAt!,
    replyText: row.replyText,
    employeeName: row.employee?.name ?? null,
    // Публічно показуємо ім'я та першу літеру прізвища: «Олена К.».
    // Повне прізвище клієнта на відкритій сторінці — зайве розкриття,
    // якого людина не очікує, залишаючи відгук салону.
    author: [row.client.firstName, row.client.lastName?.[0] ? `${row.client.lastName[0]}.` : null]
      .filter(Boolean)
      .join(" "),
  }));
}

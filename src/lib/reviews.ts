import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/mail";
import { reviewRequestEmail } from "@/lib/mail/templates";
import { appUrl } from "@/lib/app-url";

/**
 * Відгуки про візит.
 *
 * Навіщо взагалі: салон знаходять за відгуками на картах. CRM, яка
 * надійно перетворює задоволених клієнтів на публічні відгуки, окупає
 * себе першим же новим клієнтом — це найпряміший вплив на гроші з усього,
 * що тут є.
 *
 * ЧОГО ТУТ СВІДОМО НЕМАЄ — відбору за оцінкою. Спокуслива схема «п'ять
 * зірок веду на Google, менше — лишаю собі» називається review gating і
 * прямо заборонена правилами Google: за неї площадка може зняти бізнесу
 * ВСІ відгуки одразу. Тобто функція, що мала приводити клієнтів,
 * обнуляє репутацію.
 *
 * Тому посилання на публічну площадку бачать усі. Низька оцінка лише
 * додає крок «розкажіть, що сталося» перед ним — щоб людину спершу
 * вислухали ми. За ефектом майже те саме: більшості незадоволених треба
 * бути почутими, а не покарати.
 */

/** Скільки днів працює посилання з листа. */
const TTL_DAYS = 30;

/** Скільки разів пробуємо надіслати запит, перш ніж здатися. */
const MAX_ATTEMPTS = 5;

/** Через скільки хвилин задача, зависла в SENDING, повертається в чергу. */
const STALE_MINUTES = 10;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Ставить запит відгуку в чергу після завершеного візиту.
 *
 * Ідемпотентна: `appointmentId` унікальний, тож повторне позначення
 * візиту завершеним не створить другого запиту й не надішле другого листа.
 */
export async function scheduleReviewRequest(appointmentId: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      employeeId: true,
      status: true,
      client: { select: { email: true } },
      organization: { select: { reviewsEnabled: true, reviewDelayHours: true } },
    },
  });

  if (!appointment) return;
  if (appointment.status !== "COMPLETED") return;
  if (!appointment.organization.reviewsEnabled) return;
  // Питати нема куди — але й помилкою це не є: більшість записів
  // адміністратор створює з телефоном без пошти.
  if (!appointment.client.email) return;

  const existing = await prisma.review.findUnique({
    where: { appointmentId },
    select: { id: true },
  });
  if (existing) return;

  const now = Date.now();

  // Тут — випадкова заглушка, а не робочий секрет: колонка унікальна й
  // обов'язкова, а справжній токен видається в момент відправки листа
  // (див. dispatchDueReviewRequests). Так строк життя посилання рахується
  // від листа, а не від візиту, і кожна повторна спроба надіслати видає
  // новий секрет — старий, який нікуди не потрапив, одразу помирає.
  const placeholder = randomBytes(32).toString("base64url");

  await prisma.review.create({
    data: {
      organizationId: appointment.organizationId,
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      employeeId: appointment.employeeId,
      tokenHash: hashToken(placeholder),
      sendAfter: new Date(now + appointment.organization.reviewDelayHours * 3600_000),
      expiresAt: new Date(now + TTL_DAYS * 24 * 3600_000),
    },
  });
}

/** Візит скасували або перевели назад — питати враження вже недоречно. */
export async function cancelReviewRequest(appointmentId: string): Promise<void> {
  await prisma.review.updateMany({
    where: { appointmentId, status: { in: ["PENDING", "SENDING"] }, submittedAt: null },
    data: { status: "CANCELLED" },
  });
}

async function reclaimStale(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const { count } = await prisma.review.updateMany({
    where: { status: "SENDING", updatedAt: { lt: cutoff } },
    data: { status: "PENDING" },
  });
  if (count > 0) console.warn(`[reviews] повернуто в чергу зависло: ${count}`);
}

/**
 * Розсилає запити, чий час настав. Викликається тим самим cron, що й
 * нагадування: окремий планувальник заради другої черги не потрібен.
 *
 * Захоплення задач атомарне — так само, як у нагадуваннях: два одночасні
 * запуски не попросять відгук двічі.
 */
export async function dispatchDueReviewRequests(limit = 25) {
  await reclaimStale();

  const due = await prisma.review.findMany({
    where: { status: "PENDING", sendAfter: { lte: new Date() } },
    take: limit,
    orderBy: { sendAfter: "asc" },
    select: {
      id: true,
      attempts: true,
      client: { select: { firstName: true, lastName: true, email: true } },
      employee: { select: { name: true } },
      appointment: { select: { startAt: true, service: { select: { name: true } } } },
      organization: { select: { name: true } },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const review of due) {
    const claim = await prisma.review.updateMany({
      where: { id: review.id, status: "PENDING" },
      data: { status: "SENDING" },
    });
    if (claim.count === 0) continue;

    const attempts = review.attempts + 1;

    try {
      if (!review.client.email) throw new Error("У клієнта немає email");

      // Справжній секрет видається саме зараз. У базу лягає лише хеш,
      // тож сирий токен існує рівно в цьому запиті й далі — тільки в
      // поштовій скриньці клієнта.
      const rawToken = randomBytes(32).toString("base64url");
      await prisma.review.update({
        where: { id: review.id },
        data: { tokenHash: hashToken(rawToken) },
      });

      const mail = reviewRequestEmail({
        businessName: review.organization.name,
        clientName: [review.client.firstName, review.client.lastName].filter(Boolean).join(" "),
        service: review.appointment.service.name,
        employee: review.employee?.name ?? null,
        visitedAt: review.appointment.startAt,
        reviewUrl: `${appUrl()}/review/${rawToken}`,
      });

      const result = await sendMail({ to: review.client.email, ...mail });
      if (result.error) throw new Error(result.error);

      await prisma.review.update({
        where: { id: review.id },
        data: { status: "SENT", requestedAt: new Date(), attempts, error: null },
      });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const exhausted = attempts >= MAX_ATTEMPTS;
      await prisma.review.update({
        where: { id: review.id },
        data: { status: exhausted ? "FAILED" : "PENDING", attempts, error: message },
      });
      if (exhausted) failed++;
      console.error(`[reviews] ${review.id}: ${message} (спроба ${attempts})`);
    }
  }

  return { picked: due.length, sent, failed };
}

export type ReviewInvite = {
  id: string;
  businessName: string;
  service: string;
  employee: string | null;
  visitedAt: Date;
  publicUrl: string | null;
  rating: number | null;
  comment: string | null;
  submittedAt: Date | null;
};

/**
 * Знаходить відгук за токеном із листа.
 *
 * Повертає лише те, що клієнт і так знає про власний візит: салон,
 * послугу, майстра, дату. Жодних чужих даних, жодних ідентифікаторів,
 * за якими можна дістатися до решти бази.
 */
export async function findReviewByToken(rawToken: string): Promise<ReviewInvite | null> {
  if (!rawToken || rawToken.length > 100) return null;

  const review = await prisma.review.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: {
      id: true,
      expiresAt: true,
      rating: true,
      comment: true,
      submittedAt: true,
      employee: { select: { name: true } },
      appointment: { select: { startAt: true, service: { select: { name: true } } } },
      organization: { select: { name: true, reviewPublicUrl: true } },
    },
  });

  if (!review) return null;
  if (review.expiresAt.getTime() < Date.now()) return null;

  return {
    id: review.id,
    businessName: review.organization.name,
    service: review.appointment.service.name,
    employee: review.employee?.name ?? null,
    visitedAt: review.appointment.startAt,
    publicUrl: review.organization.reviewPublicUrl,
    rating: review.rating,
    comment: review.comment,
    submittedAt: review.submittedAt,
  };
}

/**
 * Записує оцінку. Клієнт може змінити відповідь, поки посилання живе —
 * людина цілком може поставити зірку зопалу, а потім дописати чому.
 */
export async function submitReview(params: {
  rawToken: string;
  rating: number;
  comment: string | null;
}): Promise<boolean> {
  const { count } = await prisma.review.updateMany({
    where: { tokenHash: hashToken(params.rawToken), expiresAt: { gt: new Date() } },
    data: {
      rating: params.rating,
      comment: params.comment?.trim() || null,
      submittedAt: new Date(),
    },
  });
  return count > 0;
}

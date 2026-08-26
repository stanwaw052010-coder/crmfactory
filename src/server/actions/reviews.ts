"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { audit } from "@/lib/audit";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { consume, LIMITS } from "@/lib/rate-limit";
import { clientIp } from "@/lib/audit";
import { submitReview } from "@/lib/reviews";

/**
 * Збереження відгуку. Публічна дія: її викликає клієнт салону, який
 * НЕ авторизований і взагалі не має акаунта.
 *
 * Тому тут немає жодного ідентифікатора з форми, окрім самого токена:
 * організацію, візит і клієнта визначає він. Підмінити чужий відгук,
 * підставивши інший id, ніде.
 */

const schema = z.object({
  token: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
});

export async function submitReviewAction(input: {
  token: string;
  rating: number;
  comment: string | null;
}): Promise<ActionResult<{ saved: true }>> {
  try {
    const ip = await clientIp();
    const limit = consume(`review:${ip}`, LIMITS.review.limit, LIMITS.review.windowSec);
    if (!limit.allowed) {
      return fail("Забагато спроб. Спробуйте трохи пізніше.");
    }

    const parsed = schema.parse(input);
    const saved = await submitReview({
      rawToken: parsed.token,
      rating: parsed.rating,
      comment: parsed.comment ?? null,
    });

    // Однакова відповідь на «токена не існує» і «строк вийшов» — щоб
    // сторінку не можна було використати як перевірку чужих посилань.
    if (!saved) return fail("Посилання більше не діє. Зверніться до салону.");

    return ok({ saved: true });
  } catch (caught) {
    return toActionError(caught);
  }
}

/**
 * Відповідь салону на відгук.
 *
 * Відповідь бачить клієнт лише тоді, коли відгук опубліковано —
 * на закриті відгуки вона працює як внутрішня позначка «розібралися».
 */
export async function replyToReviewAction(input: {
  id: string;
  text: string;
}): Promise<ActionResult<{ replied: true }>> {
  try {
    const ctx = await requirePermission("review.manage");
    const text = input.text.trim().slice(0, 2000);

    // Оновлюємо ТІЛЬКИ в межах своєї організації: id прийшов із форми,
    // і сам по собі нічого не доводить.
    const { count } = await prisma.review.updateMany({
      where: { id: input.id, organizationId: ctx.organization.id },
      data: text
        ? { replyText: text, repliedAt: new Date() }
        : { replyText: null, repliedAt: null },
    });
    if (count === 0) return fail("Відгук не знайдено");

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "review.reply",
      entityType: "review",
      entityId: input.id,
    });

    revalidatePath("/reviews");
    return ok({ replied: true });
  } catch (caught) {
    return toActionError(caught);
  }
}

/** Показувати відгук на публічній сторінці салону чи ні. Вирішує салон. */
export async function toggleReviewPublicAction(input: {
  id: string;
  isPublic: boolean;
}): Promise<ActionResult<{ isPublic: boolean }>> {
  try {
    const ctx = await requirePermission("review.manage");

    const { count } = await prisma.review.updateMany({
      where: { id: input.id, organizationId: ctx.organization.id, submittedAt: { not: null } },
      data: { isPublic: input.isPublic },
    });
    if (count === 0) return fail("Відгук не знайдено");

    revalidatePath("/reviews");
    return ok({ isPublic: input.isPublic });
  } catch (caught) {
    return toActionError(caught);
  }
}

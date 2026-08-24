import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/**
 * Токени відновлення пароля.
 *
 * Той самий принцип, що й у сесій: у листі — випадковий секрет, у базі —
 * лише його SHA-256. Порівняння йде по хешу (унікальний індекс), тому
 * пошук — за один запит, а дамп бази не дає можливості увійти.
 */

export const RESET_TTL_MINUTES = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Створює токен і одразу гасить усі попередні — активним лишається останній. */
export async function issueResetToken(userId: string, ip?: string | null) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(rawToken), expiresAt, ip: ip ?? null },
    }),
  ]);

  return { rawToken, expiresAt };
}

export type ResetTokenLookup =
  | { valid: true; tokenId: string; userId: string; email: string; name: string }
  | { valid: false };

/**
 * Перевіряє токен: існує, не використаний, не протермінований.
 * Довжину рядка обмежуємо до пошуку — щоб не ганяти в БД сміття довільного розміру.
 */
export async function findValidResetToken(rawToken: string): Promise<ResetTokenLookup> {
  if (!rawToken || rawToken.length > 200) return { valid: false };

  const candidate = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!candidate) return { valid: false };
  if (candidate.usedAt) return { valid: false };
  if (candidate.expiresAt.getTime() <= Date.now()) return { valid: false };

  return {
    valid: true,
    tokenId: candidate.id,
    userId: candidate.user.id,
    email: candidate.user.email,
    name: candidate.user.name,
  };
}

/**
 * Позначає токен використаним. `updateMany` з умовою `usedAt: null` — це
 * атомарний compare-and-set: два паралельні запити з тим самим посиланням
 * дадуть count 1 і 0, тож пароль зміниться рівно один раз.
 */
export async function consumeResetToken(tokenId: string): Promise<boolean> {
  const result = await prisma.passwordResetToken.updateMany({
    where: { id: tokenId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}

/** Порівняння секретів без витоку часу — для ключа аварійного доступу. */
export function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Аварійний доступ увімкнений лише коли задані обидві змінні. */
export function recoveryEnabled(): boolean {
  return Boolean(
    process.env.ADMIN_RECOVERY_KEY?.trim() && process.env.SUPER_ADMIN_EMAIL?.trim(),
  );
}

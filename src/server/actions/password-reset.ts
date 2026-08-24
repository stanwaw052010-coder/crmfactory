"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  RESET_TTL_MINUTES,
  consumeResetToken,
  findValidResetToken,
  issueResetToken,
  safeCompare,
} from "@/lib/auth/password-reset";
import { sendMail, mailEnabled } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/mail/templates";
import { forgotPasswordSchema, recoverySchema, resetPasswordSchema } from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { consume, LIMITS } from "@/lib/rate-limit";
import { audit, clientIp } from "@/lib/audit";

/** Базова адреса для посилань у листах. */
async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  // На хостингу змінна може бути не задана — тоді беремо реальний хост запиту.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3001";
}

/**
 * Крок 1 — запит на відновлення.
 *
 * Відповідь ЗАВЖДИ однакова, існує такий email чи ні. Інакше форму можна
 * використати як довідник зареєстрованих адрес.
 */
export async function requestPasswordResetAction(
  _prev: ActionResult<{ sent: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: true }>> {
  try {
    const ip = await clientIp();
    const input = forgotPasswordSchema.parse({ email: formData.get("email") });

    const limit = consume(
      `reset:${ip}`,
      LIMITS.passwordReset.limit,
      LIMITS.passwordReset.windowSec,
    );
    if (!limit.allowed) {
      return fail(
        `Забагато запитів. Спробуйте через ${Math.ceil(limit.retryAfterSec / 60)} хв.`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      const { rawToken } = await issueResetToken(user.id, ip);
      const url = `${await appOrigin()}/reset-password?token=${rawToken}`;
      const mail = passwordResetEmail({
        name: user.name,
        url,
        minutes: RESET_TTL_MINUTES,
      });

      await sendMail({ to: user.email, ...mail });
      await audit({
        userId: user.id,
        action: "auth.password_reset_requested",
        meta: { channel: mailEnabled() ? "email" : "log" },
      });
    }

    return ok({ sent: true } as const);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Крок 2 — новий пароль.
 *
 * Токен гаситься першим (атомарний compare-and-set), і лише потім міняється
 * пароль. Усі сесії користувача видаляються: якщо доступ втратили через
 * компрометацію, зловмисник вилітає разом зі зміною пароля.
 */
export async function resetPasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ip = await clientIp();
    const limit = consume(
      `reset-submit:${ip}`,
      LIMITS.passwordReset.limit,
      LIMITS.passwordReset.windowSec,
    );
    if (!limit.allowed) {
      return fail(`Забагато спроб. Спробуйте через ${Math.ceil(limit.retryAfterSec / 60)} хв.`);
    }

    const input = resetPasswordSchema.parse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const lookup = await findValidResetToken(input.token);
    if (!lookup.valid) {
      return fail("Посилання застаріло або вже використане. Запросіть нове.");
    }

    const consumed = await consumeResetToken(lookup.tokenId);
    if (!consumed) {
      return fail("Посилання застаріло або вже використане. Запросіть нове.");
    }

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: lookup.userId }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: lookup.userId } }),
    ]);

    await audit({ userId: lookup.userId, action: "auth.password_reset_completed" });
  } catch (error) {
    return toActionError(error);
  }
  redirect("/login?reset=1");
}

/**
 * Аварійне відновлення доступу власника платформи.
 *
 * Працює без пошти: ключ задається змінною середовища на хостингу, тобто
 * знати його може лише той, хто має доступ до налаштувань деплою. Змінити
 * пароль можна тільки акаунту з SUPER_ADMIN_EMAIL — це не універсальний
 * бекдор до чужих акаунтів.
 */
export async function recoverAdminAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ip = await clientIp();
    const limit = consume(`recovery:${ip}`, LIMITS.recovery.limit, LIMITS.recovery.windowSec);
    if (!limit.allowed) {
      return fail(`Забагато спроб. Спробуйте через ${Math.ceil(limit.retryAfterSec / 60)} хв.`);
    }

    const configuredKey = process.env.ADMIN_RECOVERY_KEY?.trim();
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
    if (!configuredKey || !superAdminEmail) {
      return fail("Аварійне відновлення вимкнено на цьому сервері.");
    }

    const input = recoverySchema.parse({
      email: formData.get("email"),
      key: formData.get("key"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const keyMatches = safeCompare(input.key, configuredKey);
    const emailMatches = input.email === superAdminEmail;

    if (!keyMatches || !emailMatches) {
      await audit({ action: "auth.recovery_failed", meta: { email: input.email } });
      return fail("Невірний email або ключ відновлення");
    }

    const user = await prisma.user.findUnique({
      where: { email: superAdminEmail },
      select: { id: true },
    });
    if (!user) {
      return fail(
        "Акаунт із цим email ще не створено. Зареєструйтеся звичайним способом — роль супер-адміна призначиться автоматично.",
      );
    }

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, isSuperAdmin: true },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    await audit({ userId: user.id, action: "auth.recovery_completed" });
  } catch (error) {
    return toActionError(error);
  }
  redirect("/login?reset=1");
}

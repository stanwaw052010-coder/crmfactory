"use server";

import { revalidatePath } from "next/cache";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/context";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { PLAN_PRICE_CENTS } from "@/lib/plans";
import { mailStatus, sendMail } from "@/lib/mail";
import { testEmailHtml } from "@/lib/mail/templates";
import { testEmailSchema } from "@/lib/validation";

/**
 * Дії панелі платформи.
 *
 * Тут єдина перевірка доступу — супер-адмін. Це навмисно НЕ той самий
 * `requirePermission()`, що всередині CRM: там права рахуються в межах
 * організації, а тут дія стосується чужих організацій, і роль власника
 * бізнесу не має давати до неї доступу.
 */
async function requireSuperAdminOrFail() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: fail("Потрібна авторизація") };
  if (!user.isSuperAdmin) return { user: null, error: fail("Недостатньо прав") };
  return { user, error: null };
}

const PLANS: Plan[] = ["FREE", "STARTER", "BUSINESS", "PRO"];

/**
 * Видає організації тариф — зокрема безкоштовний PRO на час тестування.
 * `trialDays > 0` означає пробний доступ: підписка позначається як TRIALING
 * і має дату завершення, тож видно, коли період спливає.
 */
export async function setOrganizationPlanAction(input: {
  organizationId: string;
  plan: string;
  trialDays?: number;
}): Promise<ActionResult<null>> {
  try {
    const { user, error } = await requireSuperAdminOrFail();
    if (error) return error;

    if (!PLANS.includes(input.plan as Plan)) return fail("Невідомий тариф");
    const plan = input.plan as Plan;

    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, name: true },
    });
    if (!organization) return fail("Організацію не знайдено");

    const trialDays = Math.max(0, Math.min(365, Math.round(input.trialDays ?? 0)));
    const isTrial = trialDays > 0;
    const endsAt = isTrial ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;

    await prisma.subscription.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        plan,
        status: isTrial ? "TRIALING" : plan === "FREE" ? "TRIALING" : "ACTIVE",
        // Пробний доступ безкоштовний, тому ціна нульова — інакше він
        // потрапив би в MRR і зіпсував статистику платформи.
        priceCents: isTrial ? 0 : PLAN_PRICE_CENTS[plan],
        currentPeriodStart: new Date(),
        currentPeriodEnd: endsAt,
        trialEndsAt: endsAt,
      },
      update: {
        plan,
        status: isTrial ? "TRIALING" : plan === "FREE" ? "TRIALING" : "ACTIVE",
        priceCents: isTrial ? 0 : PLAN_PRICE_CENTS[plan],
        currentPeriodStart: new Date(),
        currentPeriodEnd: endsAt,
        trialEndsAt: endsAt,
        cancelAtPeriodEnd: false,
      },
    });

    await audit({
      organizationId: organization.id,
      userId: user!.id,
      action: "admin.plan_change",
      entityType: "organization",
      entityId: organization.id,
      meta: { plan, trialDays, grantedBy: user!.email },
    });

    revalidatePath("/admin");
    revalidatePath("/settings/billing");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Тестовий лист із панелі платформи.
 *
 * Сенс дії — прибрати здогадки з налаштування пошти. Без неї єдиний
 * спосіб дізнатися, чи працює відправка, — попросити когось скинути
 * пароль і піти читати логи хостингу. Тут одразу видно результат і
 * причину відмови, якщо лист не пішов.
 */
/** Адреса застосунку для посилань у листі. */
function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || "https://crm.factory";
}

export async function sendTestEmailAction(
  _prev: ActionResult<{ message: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { user, error } = await requireSuperAdminOrFail();
    if (error || !user) return error ?? fail("Недостатньо прав");

    const input = testEmailSchema.parse({ to: formData.get("to") });
    const status = mailStatus();

    // Зламану адресу відправника ловимо до звернення в Resend: інакше
    // у відповідь прилетить 422 без пояснення, що саме не так.
    if (!status.senderValid) {
      return fail(
        `MAIL_FROM містить некоректну адресу: ${status.from}. Потрібен формат «Назва <email@ваш-домен.com>» із повним доменом.`,
      );
    }

    if (!status.configured) {
      return fail(
        "RESEND_API_KEY не задано — лист піде в лог сервера, а не адресату. Додайте ключ у змінні середовища й перезапустіть деплой.",
      );
    }

    const result = await sendMail({
      to: input.to,
      subject: "Перевірка пошти — crm.factory",
      html: testEmailHtml(user.name, appOrigin()),
      text: `Якщо ви читаєте цей лист, відправка з crm.factory працює.\n\nВідправник: ${status.from}`,
    });

    if (result.error) return fail(result.error);

    await audit({
      userId: user.id,
      action: "admin.test_email_sent",
      meta: { to: input.to },
    });

    return ok({ message: `Лист надіслано на ${input.to}. Перевірте вхідні та «Спам».` });
  } catch (caught) {
    return toActionError(caught);
  }
}

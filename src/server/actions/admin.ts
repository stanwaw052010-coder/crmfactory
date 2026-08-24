"use server";

import { revalidatePath } from "next/cache";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/context";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { PLAN_PRICE_CENTS } from "@/lib/plans";

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

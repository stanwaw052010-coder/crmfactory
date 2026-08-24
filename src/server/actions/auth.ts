"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearActiveOrganization,
  createSession,
  destroySession,
  setActiveOrganization,
} from "@/lib/auth/session";
import { getAuthContext, getCurrentUser } from "@/lib/auth/context";
import { loginSchema, registerSchema, passwordChangeSchema, profileSchema } from "@/lib/validation";
import { AppError, fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { consume, LIMITS } from "@/lib/rate-limit";
import { audit, clientIp } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { defaultBusinessHours, pipelineStagesFor } from "@/server/bootstrap";

async function requestMeta() {
  const h = await headers();
  return { userAgent: h.get("user-agent"), ip: await clientIp() };
}

/** Гарантує унікальність slug: my-business, my-business-2, … */
async function uniqueSlug(base: string): Promise<string> {
  const seed = slugify(base) || "workspace";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? seed : `${seed}-${i + 1}`;
    const exists = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${seed}-${Date.now().toString(36)}`;
}

export async function registerAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const meta = await requestMeta();
    const limit = consume(`register:${meta.ip}`, LIMITS.register.limit, LIMITS.register.windowSec);
    if (!limit.allowed) {
      return fail("Забагато спроб реєстрації. Спробуйте за кілька хвилин.");
    }

    const input = registerSchema.parse({
      businessName: formData.get("businessName"),
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return fail("Такий email вже зареєстровано", { email: "Цей email вже використовується" });
    }

    const slug = await uniqueSlug(input.businessName);
    const passwordHash = await hashPassword(input.password);
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          isSuperAdmin: superAdminEmail ? input.email === superAdminEmail : false,
        },
      });

      const organization = await tx.organization.create({
        data: { name: input.businessName, slug },
      });

      await tx.membership.create({
        data: { userId: createdUser.id, organizationId: organization.id, role: "OWNER" },
      });
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          plan: "FREE",
          status: "TRIALING",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.businessHours.createMany({ data: defaultBusinessHours(organization.id) });
      await tx.pipelineStage.createMany({ data: pipelineStagesFor(organization.id) });
      await tx.notification.create({
        data: {
          organizationId: organization.id,
          type: "SYSTEM",
          title: "Ласкаво просимо до crm.factory 🚀",
          body: "Налаштуйте бізнес за кілька кроків — і починайте приймати записи.",
        },
      });

      return { createdUser, organization };
    });

    await createSession(user.createdUser.id, meta);
    await setActiveOrganization(user.organization.id);
    await audit({
      organizationId: user.organization.id,
      userId: user.createdUser.id,
      action: "auth.register",
      entityType: "organization",
      entityId: user.organization.id,
    });
  } catch (error) {
    return toActionError(error);
  }
  redirect("/onboarding");
}

export async function loginAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  let target = "/dashboard";
  try {
    const meta = await requestMeta();
    const input = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const limit = consume(
      `login:${meta.ip}:${input.email}`,
      LIMITS.login.limit,
      LIMITS.login.windowSec,
    );
    if (!limit.allowed) {
      return fail(`Забагато спроб. Спробуйте через ${Math.ceil(limit.retryAfterSec / 60)} хв.`);
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: { select: { id: true, onboardingCompleted: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    // Однакова відповідь для «немає користувача» і «невірний пароль» —
    // щоб не можна було перебором дізнатися, хто зареєстрований.
    const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !valid) {
      return fail("Невірний email або пароль");
    }

    await createSession(user.id, meta);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const membership = user.memberships[0];
    if (membership) {
      await setActiveOrganization(membership.organizationId);
      if (!membership.organization.onboardingCompleted) target = "/onboarding";
    } else if (user.isSuperAdmin) {
      target = "/admin";
    } else {
      target = "/workspace/new";
    }

    await audit({ userId: user.id, action: "auth.login" });
  } catch (error) {
    return toActionError(error);
  }
  redirect(target);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  await clearActiveOrganization();
  if (user) await audit({ userId: user.id, action: "auth.logout" });
  redirect("/login");
}

export async function switchOrganizationAction(organizationId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Перемкнутися можна лише на організацію, де користувач справді є учасником.
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new AppError("Немає доступу до цього workspace");
  }

  await setActiveOrganization(organizationId);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateProfileAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return fail("Потрібна авторизація");

    const input = profileSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone"),
    });

    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { name: input.name, phone: input.phone ?? null },
    });
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function changePasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return fail("Потрібна авторизація");

    const input = passwordChangeSchema.parse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) return fail("Невірний поточний пароль", { currentPassword: "Пароль не збігається" });

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    // Всі інші сесії стають недійсними — стандартна практика після зміни пароля.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await createSession(user.id, await requestMeta());
    await audit({ userId: user.id, action: "auth.password_changed" });
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

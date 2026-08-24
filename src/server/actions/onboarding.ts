"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { onboardingSchema } from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { defaultSchedule } from "@/server/bootstrap";
import { slugify } from "@/lib/utils";

type OnboardingPayload = {
  industry: string;
  timezone: string;
  currency: string;
  slug: string;
  services: { name: string; durationMin: number; priceCents: number }[];
  employees: { name: string; position?: string }[];
  openMinute: number;
  closeMinute: number;
  workingDays: number[];
};

/**
 * Онбординг за один крок збереження: сфера → послуги → команда → графік → booking.
 * Усе створюється в одній транзакції, щоб не лишити напівналаштований workspace.
 */
export async function completeOnboardingAction(
  payload: OnboardingPayload,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const input = onboardingSchema.parse(payload);

    let slug = slugify(input.slug);
    const taken = await prisma.organization.findFirst({
      where: { slug, id: { not: ctx.organization.id } },
      select: { id: true },
    });
    if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: ctx.organization.id },
        data: {
          industry: input.industry,
          timezone: input.timezone,
          currency: input.currency,
          slug,
          onboardingCompleted: true,
          onboardingStep: 6,
        },
      });

      await tx.businessHours.deleteMany({ where: { organizationId: ctx.organization.id } });
      await tx.businessHours.createMany({
        data: Array.from({ length: 7 }, (_, weekday) => ({
          organizationId: ctx.organization.id,
          weekday,
          openMinute: input.openMinute,
          closeMinute: input.closeMinute,
          isClosed: !input.workingDays.includes(weekday),
        })),
      });

      const employeeIds: string[] = [];
      for (const employee of input.employees) {
        const created = await tx.employee.create({
          data: {
            organizationId: ctx.organization.id,
            name: employee.name,
            position: employee.position ?? null,
            color: "#2563EB",
          },
        });
        employeeIds.push(created.id);
        await tx.employeeSchedule.createMany({
          data: defaultSchedule(created.id).map((day) => ({
            ...day,
            startMinute: input.openMinute,
            endMinute: input.closeMinute,
            isDayOff: !input.workingDays.includes(day.weekday),
          })),
        });
      }

      for (const [index, service] of input.services.entries()) {
        await tx.service.create({
          data: {
            organizationId: ctx.organization.id,
            name: service.name,
            durationMin: service.durationMin,
            priceCents: service.priceCents,
            sortOrder: index,
            employees: { create: employeeIds.map((employeeId) => ({ employeeId })) },
          },
        });
      }

      // Прив'язуємо власника до першого співробітника — щоб його записи
      // одразу відображалися в календарі як «свої».
      if (employeeIds[0] && !ctx.membership.employeeId) {
        await tx.membership.update({
          where: { id: ctx.membership.id },
          data: { employeeId: employeeIds[0] },
        });
      }
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "onboarding.complete",
    });
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function skipOnboardingAction() {
  const ctx = await requirePermission("settings.manage");
  const employees = await prisma.employee.count({ where: { organizationId: ctx.organization.id } });

  if (employees === 0) {
    const employee = await prisma.employee.create({
      data: {
        organizationId: ctx.organization.id,
        name: ctx.user.name,
        position: "Власник",
      },
    });
    await prisma.employeeSchedule.createMany({ data: defaultSchedule(employee.id) });
    if (!ctx.membership.employeeId) {
      await prisma.membership.update({
        where: { id: ctx.membership.id },
        data: { employeeId: employee.id },
      });
    }
  }

  await prisma.organization.update({
    where: { id: ctx.organization.id },
    data: { onboardingCompleted: true },
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Створення додаткового workspace для вже авторизованого користувача. */
export async function createWorkspaceAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const { getCurrentUser } = await import("@/lib/auth/context");
  const { setActiveOrganization } = await import("@/lib/auth/session");
  const { defaultBusinessHours, pipelineStagesFor } = await import("@/server/bootstrap");

  let created: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Потрібна авторизація");

    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) return fail("Вкажіть назву бізнесу", { name: "Мінімум 2 символи" });

    let slug = slugify(name) || "workspace";
    const exists = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name, slug } });
      await tx.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "OWNER" },
      });
      await tx.subscription.create({ data: { organizationId: org.id, plan: "FREE" } });
      await tx.businessHours.createMany({ data: defaultBusinessHours(org.id) });
      await tx.pipelineStage.createMany({ data: pipelineStagesFor(org.id) });
      return org;
    });

    await setActiveOrganization(organization.id);
    created = organization.id;
  } catch (error) {
    return toActionError(error);
  }
  if (created) redirect("/onboarding");
  return ok(null);
}

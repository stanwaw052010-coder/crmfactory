"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import {
  bookingSettingsSchema,
  businessHoursSchema,
  notificationSettingsSchema,
  organizationSchema,
} from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";

export async function updateOrganizationAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const input = organizationSchema.parse({
      name: formData.get("name"),
      industry: formData.get("industry"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      address: formData.get("address"),
      about: formData.get("about"),
      timezone: formData.get("timezone"),
      currency: formData.get("currency"),
      brandColor: formData.get("brandColor") || "#2563EB",
      logoUrl: formData.get("logoUrl"),
    });

    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: {
        name: input.name,
        industry: input.industry ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        about: input.about ?? null,
        timezone: input.timezone,
        currency: input.currency,
        brandColor: input.brandColor,
        logoUrl: input.logoUrl ?? null,
      },
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "settings.organization",
    });
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBookingSettingsAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const input = bookingSettingsSchema.parse({
      slug: formData.get("slug"),
      bookingEnabled: formData.get("bookingEnabled") === "on",
      bookingAutoConfirm: formData.get("bookingAutoConfirm") === "on",
      bookingLeadTimeMin: formData.get("bookingLeadTimeMin"),
      bookingHorizonDays: formData.get("bookingHorizonDays"),
      bookingCancelHours: formData.get("bookingCancelHours"),
      bookingSlotStepMin: formData.get("bookingSlotStepMin"),
      bookingRequireEmail: formData.get("bookingRequireEmail") === "on",
      bookingWelcomeText: formData.get("bookingWelcomeText"),
    });

    const taken = await prisma.organization.findFirst({
      where: { slug: input.slug, id: { not: ctx.organization.id } },
      select: { id: true },
    });
    if (taken) return fail("Ця адреса вже зайнята", { slug: "Оберіть іншу адресу" });

    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: {
        slug: input.slug,
        bookingEnabled: input.bookingEnabled,
        bookingAutoConfirm: input.bookingAutoConfirm,
        bookingLeadTimeMin: input.bookingLeadTimeMin,
        bookingHorizonDays: input.bookingHorizonDays,
        bookingCancelHours: input.bookingCancelHours,
        bookingSlotStepMin: input.bookingSlotStepMin,
        bookingRequireEmail: input.bookingRequireEmail,
        bookingWelcomeText: input.bookingWelcomeText ?? null,
      },
    });

    revalidatePath("/settings/booking");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBusinessHoursAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isClosed: formData.get(`day-${weekday}-closed`) === "on",
      openMinute: Number(formData.get(`day-${weekday}-open`) ?? 540),
      closeMinute: Number(formData.get(`day-${weekday}-close`) ?? 1080),
    }));
    const input = businessHoursSchema.parse({ days });

    for (const day of input.days) {
      if (!day.isClosed && day.closeMinute <= day.openMinute) {
        return fail("Час закриття має бути пізніше за час відкриття");
      }
    }

    await prisma.$transaction(
      input.days.map((day) =>
        prisma.businessHours.upsert({
          where: {
            organizationId_weekday: {
              organizationId: ctx.organization.id,
              weekday: day.weekday,
            },
          },
          create: { organizationId: ctx.organization.id, ...day },
          update: day,
        }),
      ),
    );

    revalidatePath("/settings/booking");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateNotificationSettingsAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const input = notificationSettingsSchema.parse({
      reminderEnabled: formData.get("reminderEnabled") === "on",
      reminderHoursBefore: formData.get("reminderHoursBefore"),
      channels: formData.getAll("channels").map(String),
    });

    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: {
        reminderEnabled: input.reminderEnabled,
        reminderHoursBefore: input.reminderHoursBefore,
        reminderChannels: input.channels.join(","),
      },
    });

    revalidatePath("/settings/notifications");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function changePlanAction(
  plan: "FREE" | "STARTER" | "BUSINESS" | "PRO",
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("billing.manage");
    const prices = { FREE: 0, STARTER: 1900, BUSINESS: 3900, PRO: 7900 } as const;

    // Реальний платіж підключиться тут (Stripe Checkout) — доменна модель
    // уже зберігає external-ідентифікатори й період підписки.
    await prisma.subscription.upsert({
      where: { organizationId: ctx.organization.id },
      create: {
        organizationId: ctx.organization.id,
        plan,
        status: plan === "FREE" ? "TRIALING" : "ACTIVE",
        priceCents: prices[plan],
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        plan,
        status: plan === "FREE" ? "TRIALING" : "ACTIVE",
        priceCents: prices[plan],
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      },
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "billing.plan_change",
      meta: { plan },
    });
    revalidatePath("/settings/billing");
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

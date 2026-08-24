"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import {
  appointmentMoveSchema,
  appointmentSchema,
  appointmentStatusSchema,
} from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import {
  cancelAppointmentReminders,
  scheduleAppointmentReminders,
} from "@/lib/reminders";
import { combineDateTime, formatDateTimeUk, minutesOfDay, startOfDay } from "@/lib/time";
import { parseMoneyToCents } from "@/lib/money";
import { freeIntervals } from "@/lib/availability";

/**
 * Перевірка конфліктів. Виконується завжди на сервері — незалежно від того,
 * що показував календар у браузері.
 */
async function assertNoConflict(params: {
  organizationId: string;
  employeeId: string;
  startAt: Date;
  durationMin: number;
  ignoreAppointmentId?: string;
}): Promise<string | null> {
  const overlapping = await prisma.appointment.findFirst({
    where: {
      organizationId: params.organizationId,
      employeeId: params.employeeId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startAt: { lt: new Date(params.startAt.getTime() + params.durationMin * 60_000) },
      endAt: { gt: params.startAt },
      ...(params.ignoreAppointmentId ? { id: { not: params.ignoreAppointmentId } } : {}),
    },
    include: { client: { select: { firstName: true, lastName: true } } },
  });

  if (overlapping) {
    const name = [overlapping.client.firstName, overlapping.client.lastName]
      .filter(Boolean)
      .join(" ");
    return `Цей час уже зайнятий: ${name} о ${formatDateTimeUk(overlapping.startAt)}`;
  }
  return null;
}

/** М'яка перевірка графіка: попереджаємо, але не блокуємо роботу адміністратора. */
async function outsideSchedule(params: {
  organizationId: string;
  employeeId: string;
  startAt: Date;
  durationMin: number;
  ignoreAppointmentId?: string;
}): Promise<boolean> {
  const windows = await freeIntervals({
    organizationId: params.organizationId,
    employeeId: params.employeeId,
    date: params.startAt,
    durationMin: params.durationMin,
    ignoreAppointmentId: params.ignoreAppointmentId,
  });
  const start = minutesOfDay(params.startAt);
  const end = start + params.durationMin;
  return !windows.some((w) => w.start <= start && w.end >= end);
}

export async function createAppointmentAction(
  _prev: ActionResult<{ id: string; warning?: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; warning?: string }>> {
  try {
    const ctx = await requirePermission("appointment.create");

    const input = appointmentSchema.parse({
      clientId: formData.get("clientId"),
      serviceId: formData.get("serviceId"),
      employeeId: formData.get("employeeId"),
      date: formData.get("date"),
      time: formData.get("time"),
      durationMin: formData.get("durationMin"),
      priceCents: parseMoneyToCents(String(formData.get("price") ?? "0")),
      status: formData.get("status") || "CONFIRMED",
      note: formData.get("note"),
    });

    // Усі три сутності мають належати цій організації — інакше витік даних.
    const [client, service, employee] = await Promise.all([
      prisma.client.findUnique({ where: { id: input.clientId } }),
      prisma.service.findUnique({ where: { id: input.serviceId } }),
      prisma.employee.findUnique({ where: { id: input.employeeId } }),
    ]);
    assertTenant(client, ctx.organization.id);
    assertTenant(service, ctx.organization.id);
    assertTenant(employee, ctx.organization.id);

    // EMPLOYEE створює записи лише собі.
    if (!ctx.permissions.has("calendar.view_all") && ctx.membership.employeeId !== input.employeeId) {
      return fail("Ви можете створювати записи лише для себе");
    }

    const startAt = combineDateTime(input.date, input.time);
    const endAt = new Date(startAt.getTime() + input.durationMin * 60_000);

    const conflict = await assertNoConflict({
      organizationId: ctx.organization.id,
      employeeId: input.employeeId,
      startAt,
      durationMin: input.durationMin,
    });
    if (conflict) return fail(conflict);

    const warning = (await outsideSchedule({
      organizationId: ctx.organization.id,
      employeeId: input.employeeId,
      startAt,
      durationMin: input.durationMin,
    }))
      ? "Запис створено поза робочим графіком співробітника"
      : undefined;

    const appointment = await prisma.appointment.create({
      data: {
        organizationId: ctx.organization.id,
        clientId: input.clientId,
        serviceId: input.serviceId,
        employeeId: input.employeeId,
        startAt,
        endAt,
        status: input.status,
        priceCents: input.priceCents,
        note: input.note ?? null,
        createdById: ctx.user.id,
        source: "CRM",
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      },
    });

    // Новий клієнт стає активним після першого запису.
    if (client!.status === "NEW") {
      await prisma.client.update({ where: { id: client!.id }, data: { status: "ACTIVE" } });
    }

    await scheduleAppointmentReminders(appointment.id);
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "appointment.create",
      entityType: "appointment",
      entityId: appointment.id,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath(`/clients/${input.clientId}`);
    return ok({ id: appointment.id, warning });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateAppointmentAction(
  appointmentId: string,
  _prev: ActionResult<{ id: string; warning?: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; warning?: string }>> {
  try {
    const ctx = await requirePermission("appointment.update");

    const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    assertTenant(existing, ctx.organization.id);
    if (!ctx.permissions.has("calendar.view_all") && ctx.membership.employeeId !== existing!.employeeId) {
      return fail("Ви можете редагувати лише власні записи");
    }

    const input = appointmentSchema.parse({
      clientId: formData.get("clientId"),
      serviceId: formData.get("serviceId"),
      employeeId: formData.get("employeeId"),
      date: formData.get("date"),
      time: formData.get("time"),
      durationMin: formData.get("durationMin"),
      priceCents: parseMoneyToCents(String(formData.get("price") ?? "0")),
      status: formData.get("status") || "CONFIRMED",
      note: formData.get("note"),
    });

    const [client, service, employee] = await Promise.all([
      prisma.client.findUnique({ where: { id: input.clientId } }),
      prisma.service.findUnique({ where: { id: input.serviceId } }),
      prisma.employee.findUnique({ where: { id: input.employeeId } }),
    ]);
    assertTenant(client, ctx.organization.id);
    assertTenant(service, ctx.organization.id);
    assertTenant(employee, ctx.organization.id);

    const startAt = combineDateTime(input.date, input.time);
    const endAt = new Date(startAt.getTime() + input.durationMin * 60_000);

    if (input.status !== "CANCELLED" && input.status !== "NO_SHOW") {
      const conflict = await assertNoConflict({
        organizationId: ctx.organization.id,
        employeeId: input.employeeId,
        startAt,
        durationMin: input.durationMin,
        ignoreAppointmentId: appointmentId,
      });
      if (conflict) return fail(conflict);
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        clientId: input.clientId,
        serviceId: input.serviceId,
        employeeId: input.employeeId,
        startAt,
        endAt,
        status: input.status,
        priceCents: input.priceCents,
        note: input.note ?? null,
        completedAt:
          input.status === "COMPLETED" ? (existing!.completedAt ?? new Date()) : null,
        cancelledAt: input.status === "CANCELLED" ? (existing!.cancelledAt ?? new Date()) : null,
      },
    });

    await scheduleAppointmentReminders(appointmentId);
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "appointment.update",
      entityType: "appointment",
      entityId: appointmentId,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath(`/clients/${input.clientId}`);
    return ok({ id: appointmentId });
  } catch (error) {
    return toActionError(error);
  }
}

/** Drag & drop у календарі: перенесення та зміна тривалості. */
export async function moveAppointmentAction(input: {
  id: string;
  startAt: string;
  durationMin?: number;
  employeeId?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("appointment.update");
    const parsed = appointmentMoveSchema.parse(input);

    const existing = await prisma.appointment.findUnique({ where: { id: parsed.id } });
    assertTenant(existing, ctx.organization.id);
    if (!ctx.permissions.has("calendar.view_all") && ctx.membership.employeeId !== existing!.employeeId) {
      return fail("Ви можете переносити лише власні записи");
    }

    const employeeId = parsed.employeeId ?? existing!.employeeId;
    if (parsed.employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: parsed.employeeId } });
      assertTenant(employee, ctx.organization.id);
    }

    const startAt = new Date(parsed.startAt);
    const durationMin =
      parsed.durationMin ??
      Math.round((existing!.endAt.getTime() - existing!.startAt.getTime()) / 60_000);
    const endAt = new Date(startAt.getTime() + durationMin * 60_000);

    const conflict = await assertNoConflict({
      organizationId: ctx.organization.id,
      employeeId,
      startAt,
      durationMin,
      ignoreAppointmentId: parsed.id,
    });
    if (conflict) return fail(conflict);

    await prisma.appointment.update({
      where: { id: parsed.id },
      data: { startAt, endAt, employeeId },
    });
    await scheduleAppointmentReminders(parsed.id);
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "appointment.move",
      entityType: "appointment",
      entityId: parsed.id,
      meta: { startAt: startAt.toISOString(), durationMin },
    });

    revalidatePath("/calendar");
    return ok({ id: parsed.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function setAppointmentStatusAction(input: {
  id: string;
  status: string;
  cancelReason?: string;
}): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("appointment.update");
    const parsed = appointmentStatusSchema.parse(input);

    const existing = await prisma.appointment.findUnique({
      where: { id: parsed.id },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    });
    assertTenant(existing, ctx.organization.id);
    if (!ctx.permissions.has("calendar.view_all") && ctx.membership.employeeId !== existing!.employeeId) {
      return fail("Ви можете змінювати лише власні записи");
    }

    await prisma.appointment.update({
      where: { id: parsed.id },
      data: {
        status: parsed.status,
        completedAt: parsed.status === "COMPLETED" ? new Date() : null,
        cancelledAt: parsed.status === "CANCELLED" ? new Date() : null,
        cancelReason: parsed.status === "CANCELLED" ? (parsed.cancelReason ?? null) : null,
      },
    });

    if (parsed.status === "CANCELLED" || parsed.status === "NO_SHOW") {
      await cancelAppointmentReminders(parsed.id);
      await notify({
        organizationId: ctx.organization.id,
        type: "BOOKING_CANCELLED",
        title: parsed.status === "CANCELLED" ? "Запис скасовано" : "Клієнт не прийшов",
        body: `${existing!.client.firstName} ${existing!.client.lastName ?? ""}`.trim(),
        entityType: "appointment",
        entityId: parsed.id,
      });
    }

    // Завершений запис одразу створює продаж — менеджеру не треба дублювати руками.
    if (parsed.status === "COMPLETED" && existing!.priceCents > 0) {
      const alreadyPaid = await prisma.payment.findFirst({
        where: { appointmentId: parsed.id, status: { not: "REFUNDED" } },
      });
      if (!alreadyPaid) {
        await prisma.payment.create({
          data: {
            organizationId: ctx.organization.id,
            appointmentId: parsed.id,
            clientId: existing!.clientId,
            employeeId: existing!.employeeId,
            amountCents: existing!.priceCents,
            currency: ctx.organization.currency,
            method: "CASH",
            status: "PAID",
          },
        });
      }
    }

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "appointment.status",
      entityType: "appointment",
      entityId: parsed.id,
      meta: { status: parsed.status },
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/sales");
    revalidatePath(`/clients/${existing!.client.id}`);
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAppointmentAction(appointmentId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("appointment.delete");
    const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    assertTenant(existing, ctx.organization.id);

    await prisma.appointment.delete({ where: { id: appointmentId } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "appointment.delete",
      entityType: "appointment",
      entityId: appointmentId,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** Вільні слоти для форми запису — щоб не пропонувати зайнятий час. */
export async function getFreeSlotsAction(params: {
  employeeId: string;
  date: string;
  durationMin: number;
  ignoreAppointmentId?: string;
}): Promise<ActionResult<string[]>> {
  try {
    const ctx = await requireAuth();
    const employee = await prisma.employee.findUnique({ where: { id: params.employeeId } });
    assertTenant(employee, ctx.organization.id);

    const { availableSlots } = await import("@/lib/availability");
    const slots = await availableSlots({
      organizationId: ctx.organization.id,
      employeeId: params.employeeId,
      date: startOfDay(new Date(`${params.date}T00:00:00`)),
      durationMin: params.durationMin,
      stepMin: 15,
      ignoreAppointmentId: params.ignoreAppointmentId,
    });
    return ok(slots.map((s) => s.time));
  } catch (error) {
    return toActionError(error);
  }
}

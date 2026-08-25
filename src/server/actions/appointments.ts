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
import { runAutomations } from "@/server/automation-engine";
import {
  cancelAppointmentReminders,
  scheduleAppointmentReminders,
} from "@/lib/reminders";
import {
  addDays,
  combineDateTime,
  endOfDay,
  formatDateTimeUk,
  minutesOfDay,
  minutesToTime,
  startOfDay,
  toDateKey,
} from "@/lib/time";
import {
  DEAD_GAP_MINUTES,
  bestSlots,
  type SlotCandidate,
} from "@/lib/smart-slots";
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
    // Автоматизації запускаються ПІСЛЯ того, як запис уже збережено:
    // збій правила не має коштувати користувачу втраченого запису.
    await runAutomations("APPOINTMENT_CREATED", {
      organizationId: ctx.organization.id,
      appointmentId: appointment.id,
    });
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

    const statusTrigger =
      parsed.status === "COMPLETED"
        ? ("APPOINTMENT_COMPLETED" as const)
        : parsed.status === "CANCELLED"
          ? ("APPOINTMENT_CANCELLED" as const)
          : parsed.status === "NO_SHOW"
            ? ("APPOINTMENT_NO_SHOW" as const)
            : null;

    if (statusTrigger) {
      await runAutomations(statusTrigger, {
        organizationId: ctx.organization.id,
        appointmentId: parsed.id,
      });
    }

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

export type SlotSuggestion = {
  employeeId: string;
  employeeName: string;
  dateKey: string;
  time: string;
  reason: string;
};

/** Скільки днів наперед шукати. Далі клієнтки все одно не планують. */
const SUGGEST_HORIZON_DAYS = 7;

/**
 * Найкращий час для запису — по всіх майстрах, які виконують цю послугу.
 *
 * Відрізняється від `getFreeSlotsAction` тим, що не просто перелічує
 * вільне, а ранжує: враховує улюбленого майстра клієнтки і те, чи не
 * роздрібнить цей запис день на шматки, які вже нікому не продаси
 * (див. lib/smart-slots.ts).
 */
export async function suggestSlotsAction(params: {
  serviceId: string;
  clientId?: string;
  fromDate?: string;
}): Promise<ActionResult<SlotSuggestion[]>> {
  try {
    const ctx = await requireAuth();

    const service = await prisma.service.findUnique({
      where: { id: params.serviceId },
      include: { employees: { select: { employeeId: true } } },
    });
    assertTenant(service, ctx.organization.id);
    if (!service) return fail("Послугу не знайдено");

    const employeeIds = service.employees.map((row) => row.employeeId);
    const employees = await prisma.employee.findMany({
      where: {
        organizationId: ctx.organization.id,
        isActive: true,
        ...(employeeIds.length > 0 ? { id: { in: employeeIds } } : {}),
      },
      select: { id: true, name: true },
    });
    if (employees.length === 0) return ok([]);

    // Улюблений майстер — той, до кого клієнтка ходила найчастіше.
    let preferredEmployeeId: string | null = null;
    if (params.clientId) {
      const history = await prisma.appointment.groupBy({
        by: ["employeeId"],
        where: {
          organizationId: ctx.organization.id,
          clientId: params.clientId,
          status: "COMPLETED",
        },
        _count: { _all: true },
      });
      preferredEmployeeId =
        history.sort((a, b) => b._count._all - a._count._all)[0]?.employeeId ?? null;
    }

    // Найкоротша послуга салону задає, який хвостик уже «мертвий».
    const shortest = await prisma.service.aggregate({
      where: { organizationId: ctx.organization.id, isActive: true },
      _min: { durationMin: true },
    });

    const { freeIntervals } = await import("@/lib/availability");
    const start = startOfDay(
      params.fromDate ? new Date(`${params.fromDate}T00:00:00`) : new Date(),
    );
    // Скільки днів від СЬОГОДНІ до початку пошуку. Без цього зсуву слот
    // 26 серпня, знайдений першим, підписувався б «сьогодні» лише тому,
    // що він перший у видачі.
    const today = startOfDay(new Date());
    const offsetFromToday = Math.round(
      (start.getTime() - today.getTime()) / 86_400_000,
    );

    const candidates: SlotCandidate[] = [];

    for (let dayOffset = 0; dayOffset < SUGGEST_HORIZON_DAYS; dayOffset++) {
      const date = addDays(start, dayOffset);
      const dateKey = toDateKey(date);

      const perEmployee = await Promise.all(
        employees.map(async (employee) => {
          const intervals = await freeIntervals({
            organizationId: ctx.organization.id,
            employeeId: employee.id,
            date,
            durationMin: service.durationMin,
            stepMin: 15,
          });

          const busy = await prisma.appointment.findMany({
            where: {
              organizationId: ctx.organization.id,
              employeeId: employee.id,
              status: { in: ["CONFIRMED", "WAITING", "COMPLETED"] },
              startAt: { gte: startOfDay(date), lte: endOfDay(date) },
            },
            select: { startAt: true, endAt: true },
          });

          const busySpans = busy.map((row) => ({
            startMinute: minutesOfDay(row.startAt),
            endMinute: minutesOfDay(row.endAt),
          }));

          const rows: SlotCandidate[] = [];
          for (const interval of intervals) {
            // Крок 15 хвилин — той самий, що і в решті системи.
            for (
              let minute = interval.start;
              minute + service.durationMin <= interval.end;
              minute += 15
            ) {
              rows.push({
                employeeId: employee.id,
                employeeName: employee.name,
                dateKey,
                daysAhead: offsetFromToday + dayOffset,
                startMinute: minute,
                interval: { start: interval.start, end: interval.end },
                busy: busySpans,
              });
            }
          }
          return rows;
        }),
      );

      candidates.push(...perEmployee.flat());

      // Достатньо варіантів — далі не шукаємо, щоб не ганяти БД дарма.
      if (candidates.length >= 60) break;
    }

    const best = bestSlots(candidates, {
      preferredEmployeeId,
      durationMin: service.durationMin,
      minServiceMin: shortest._min.durationMin ?? DEAD_GAP_MINUTES,
      limit: 5,
      perEmployee: 2,
    });

    return ok(
      best.map((slot) => ({
        employeeId: slot.employeeId,
        employeeName: slot.employeeName,
        dateKey: slot.dateKey,
        time: minutesToTime(slot.startMinute),
        reason: slot.reason,
      })),
    );
  } catch (error) {
    return toActionError(error);
  }
}

"use server";

import { prisma } from "@/lib/db/prisma";
import { publicBookingSchema } from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { consume, LIMITS } from "@/lib/rate-limit";
import { clientIp, audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { scheduleAppointmentReminders } from "@/lib/reminders";
import { availableSlots } from "@/lib/availability";
import { combineDateTime, fromDateKey, toDateKey } from "@/lib/time";

/**
 * Публічне бронювання.
 *
 * Цей код виконується для НЕавторизованого відвідувача, тому кожен вхідний
 * ідентифікатор перевіряється на приналежність організації, а слот
 * перераховується заново на сервері — довіряти формі не можна.
 */

export type PublicSlotsResult = { date: string; slots: string[] };

export async function getPublicSlotsAction(params: {
  slug: string;
  serviceId: string;
  employeeId: string;
  date: string;
}): Promise<ActionResult<PublicSlotsResult>> {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        bookingEnabled: true,
        bookingLeadTimeMin: true,
        bookingSlotStepMin: true,
        bookingHorizonDays: true,
      },
    });
    if (!organization || !organization.bookingEnabled) return fail("Онлайн-запис недоступний");

    const [service, employee] = await Promise.all([
      prisma.service.findFirst({
        where: {
          id: params.serviceId,
          organizationId: organization.id,
          isActive: true,
          onlineBooking: true,
        },
        select: { durationMin: true },
      }),
      prisma.employee.findFirst({
        where: {
          id: params.employeeId,
          organizationId: organization.id,
          isActive: true,
          acceptsOnlineBooking: true,
        },
        select: { id: true },
      }),
    ]);
    if (!service || !employee) return fail("Послугу або майстра не знайдено");

    const date = fromDateKey(params.date);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + organization.bookingHorizonDays);
    if (date > horizon) return ok({ date: params.date, slots: [] });

    const slots = await availableSlots({
      organizationId: organization.id,
      employeeId: params.employeeId,
      date,
      durationMin: service.durationMin,
      stepMin: organization.bookingSlotStepMin,
      leadTimeMin: organization.bookingLeadTimeMin,
      respectBusinessHours: true,
    });

    return ok({ date: params.date, slots: slots.map((s) => s.time) });
  } catch (error) {
    return toActionError(error);
  }
}

/** Дні найближчого періоду, де є хоча б один вільний слот. */
export async function getPublicAvailableDaysAction(params: {
  slug: string;
  serviceId: string;
  employeeId: string;
  fromDate: string;
  days: number;
}): Promise<ActionResult<string[]>> {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        bookingEnabled: true,
        bookingLeadTimeMin: true,
        bookingSlotStepMin: true,
        bookingHorizonDays: true,
      },
    });
    if (!organization || !organization.bookingEnabled) return fail("Онлайн-запис недоступний");

    const service = await prisma.service.findFirst({
      where: { id: params.serviceId, organizationId: organization.id, isActive: true },
      select: { durationMin: true },
    });
    const employee = await prisma.employee.findFirst({
      where: { id: params.employeeId, organizationId: organization.id, isActive: true },
      select: { id: true },
    });
    if (!service || !employee) return fail("Послугу або майстра не знайдено");

    const from = fromDateKey(params.fromDate);
    const limit = Math.min(params.days, organization.bookingHorizonDays, 45);
    const result: string[] = [];

    for (let i = 0; i < limit; i++) {
      const date = new Date(from);
      date.setDate(date.getDate() + i);
      const slots = await availableSlots({
        organizationId: organization.id,
        employeeId: params.employeeId,
        date,
        durationMin: service.durationMin,
        stepMin: organization.bookingSlotStepMin,
        leadTimeMin: organization.bookingLeadTimeMin,
        respectBusinessHours: true,
      });
      if (slots.length > 0) result.push(toDateKey(date));
    }

    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export type BookingConfirmation = {
  appointmentId: string;
  date: string;
  time: string;
  serviceName: string;
  employeeName: string;
  priceCents: number;
  currency: string;
  businessName: string;
  autoConfirmed: boolean;
};

export async function createPublicBookingAction(
  input: unknown,
): Promise<ActionResult<BookingConfirmation>> {
  try {
    const ip = await clientIp();
    const limit = consume(`booking:${ip}`, LIMITS.booking.limit, LIMITS.booking.windowSec);
    if (!limit.allowed) {
      return fail("Забагато спроб бронювання. Спробуйте трохи пізніше.");
    }

    const parsed = publicBookingSchema.parse(input);

    const organization = await prisma.organization.findUnique({
      where: { slug: parsed.slug },
      select: {
        id: true,
        name: true,
        currency: true,
        bookingEnabled: true,
        bookingAutoConfirm: true,
        bookingLeadTimeMin: true,
        bookingSlotStepMin: true,
        bookingRequireEmail: true,
      },
    });
    if (!organization || !organization.bookingEnabled) return fail("Онлайн-запис недоступний");
    if (organization.bookingRequireEmail && !parsed.email) {
      return fail("Вкажіть email", { email: "Email обов'язковий" });
    }

    const [service, employee] = await Promise.all([
      prisma.service.findFirst({
        where: {
          id: parsed.serviceId,
          organizationId: organization.id,
          isActive: true,
          onlineBooking: true,
        },
      }),
      prisma.employee.findFirst({
        where: {
          id: parsed.employeeId,
          organizationId: organization.id,
          isActive: true,
          acceptsOnlineBooking: true,
        },
      }),
    ]);
    if (!service || !employee) return fail("Послугу або майстра не знайдено");

    // Слот перевіряється заново — між вибором і підтвердженням його могли зайняти.
    const startAt = combineDateTime(parsed.date, parsed.time);
    const slots = await availableSlots({
      organizationId: organization.id,
      employeeId: employee.id,
      date: startAt,
      durationMin: service.durationMin,
      stepMin: organization.bookingSlotStepMin,
      leadTimeMin: organization.bookingLeadTimeMin,
      respectBusinessHours: true,
    });
    if (!slots.some((s) => s.time === parsed.time)) {
      return fail("На жаль, цей час щойно зайняли. Оберіть інший.");
    }

    const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);
    const [firstName, ...rest] = parsed.name.trim().split(/\s+/);

    const appointment = await prisma.$transaction(async (tx) => {
      // Клієнта шукаємо за телефоном у межах цієї ж організації.
      let client = await tx.client.findFirst({
        where: { organizationId: organization.id, phone: parsed.phone },
      });
      if (!client) {
        client = await tx.client.create({
          data: {
            organizationId: organization.id,
            firstName: firstName || parsed.name,
            lastName: rest.join(" ") || null,
            phone: parsed.phone,
            email: parsed.email ?? null,
            status: "NEW",
            source: "Онлайн-запис",
          },
        });
      } else if (parsed.email && !client.email) {
        await tx.client.update({ where: { id: client.id }, data: { email: parsed.email } });
      }

      return tx.appointment.create({
        data: {
          organizationId: organization.id,
          clientId: client.id,
          serviceId: service.id,
          employeeId: employee.id,
          startAt,
          endAt,
          status: organization.bookingAutoConfirm ? "CONFIRMED" : "WAITING",
          source: "ONLINE",
          priceCents: service.priceCents,
          note: parsed.comment ?? null,
        },
      });
    });

    await scheduleAppointmentReminders(appointment.id);
    await notify({
      organizationId: organization.id,
      type: "BOOKING_CREATED",
      title: "Новий онлайн-запис",
      body: `${parsed.name} — ${service.name}`,
      entityType: "appointment",
      entityId: appointment.id,
    });
    await audit({
      organizationId: organization.id,
      action: "booking.public_create",
      entityType: "appointment",
      entityId: appointment.id,
      meta: { source: "ONLINE" },
    });

    return ok({
      appointmentId: appointment.id,
      date: parsed.date,
      time: parsed.time,
      serviceName: service.name,
      employeeName: employee.name,
      priceCents: service.priceCents,
      currency: organization.currency,
      businessName: organization.name,
      autoConfirmed: organization.bookingAutoConfirm,
    });
  } catch (error) {
    return toActionError(error);
  }
}

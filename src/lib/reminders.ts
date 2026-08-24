import "server-only";
import type { ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Нагадування про записи.
 *
 * Зараз реально доставляється канал IN_APP. EMAIL / TELEGRAM / SMS / WHATSAPP
 * створюються в черзі зі статусом PENDING — щоб додати справжню відправку,
 * достатньо реалізувати `deliver()` для каналу та запустити воркер
 * (cron → `dispatchDueReminders()`), не змінюючи решту застосунку.
 */

export function parseChannels(raw: string): ReminderChannel[] {
  const known: ReminderChannel[] = ["IN_APP", "EMAIL", "TELEGRAM", "SMS", "WHATSAPP"];
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is ReminderChannel => known.includes(c as ReminderChannel));
}

export async function scheduleAppointmentReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          reminderEnabled: true,
          reminderHoursBefore: true,
          reminderChannels: true,
        },
      },
      client: { select: { firstName: true, lastName: true, phone: true, email: true } },
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });
  if (!appointment) return;

  const org = appointment.organization;
  await cancelAppointmentReminders(appointmentId);
  if (!org.reminderEnabled) return;
  if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") return;

  const scheduledFor = new Date(
    appointment.startAt.getTime() - org.reminderHoursBefore * 60 * 60 * 1000,
  );
  if (scheduledFor.getTime() <= Date.now()) return;

  const channels = parseChannels(org.reminderChannels);
  if (channels.length === 0) return;

  await prisma.reminderJob.createMany({
    data: channels.map((channel) => ({
      organizationId: org.id,
      appointmentId,
      channel,
      scheduledFor,
      payload: {
        clientName: [appointment.client.firstName, appointment.client.lastName]
          .filter(Boolean)
          .join(" "),
        phone: appointment.client.phone,
        email: appointment.client.email,
        service: appointment.service.name,
        employee: appointment.employee.name,
        startAt: appointment.startAt.toISOString(),
        businessName: org.name,
      },
    })),
  });
}

export async function cancelAppointmentReminders(appointmentId: string) {
  await prisma.reminderJob.updateMany({
    where: { appointmentId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

/**
 * Викликається воркером/cron. Наразі доставляє IN_APP;
 * решта каналів чекають на інтеграцію провайдера.
 */
export async function dispatchDueReminders(limit = 50) {
  const due = await prisma.reminderJob.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    take: limit,
    orderBy: { scheduledFor: "asc" },
  });

  for (const job of due) {
    try {
      if (job.channel === "IN_APP") {
        const payload = (job.payload ?? {}) as Record<string, string>;
        await prisma.notification.create({
          data: {
            organizationId: job.organizationId,
            type: "APPOINTMENT_REMINDER",
            title: "Нагадування про запис",
            body: `${payload.clientName ?? "Клієнт"} — ${payload.service ?? "послуга"}`,
            entityType: "appointment",
            entityId: job.appointmentId,
          },
        });
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
        });
      } else {
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: {
            attempts: { increment: 1 },
            error: `Канал ${job.channel} ще не підключено`,
          },
        });
      }
    } catch (error) {
      await prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  }
  return due.length;
}

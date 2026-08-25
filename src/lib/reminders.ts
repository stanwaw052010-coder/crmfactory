import "server-only";
import type { ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/mail";
import { appointmentReminderEmail } from "@/lib/mail/templates";
import { appUrl } from "@/lib/app-url";
import { formatMoney } from "@/lib/money";

/**
 * Нагадування про записи.
 *
 * Черга, а не пряма відправка: `scheduleAppointmentReminders` кладе задачу
 * в `ReminderJob`, а `dispatchDueReminders` — окремий процес — її забирає.
 * Так відправка не сповільнює створення запису і переживає падіння пошти:
 * задача лишається в черзі й повториться.
 *
 * Хто викликає `dispatchDueReminders`: HTTP-роут `/api/cron/reminders`,
 * захищений `CRON_SECRET`. Роут навмисно не прив'язаний до планувальника
 * Vercel — на тарифі Hobby той уміє лише раз на добу, чого для нагадувань
 * замало. Будь-який зовнішній планувальник, що вміє HTTP, підходить.
 */

/** Скільки разів пробувати, перш ніж визнати задачу невдалою. */
const MAX_ATTEMPTS = 5;

/** Канали, які справді вміємо доставляти. Решта — у планах. */
const DELIVERABLE: ReminderChannel[] = ["IN_APP", "EMAIL"];

export function parseChannels(raw: string): ReminderChannel[] {
  const known: ReminderChannel[] = ["IN_APP", "EMAIL", "TELEGRAM", "SMS", "WHATSAPP"];
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is ReminderChannel => known.includes(c as ReminderChannel));
}

/**
 * Дані, потрібні для листа, зберігаються В САМІЙ задачі, а не читаються
 * з бази під час відправки. Причина: до моменту нагадування послугу могли
 * перейменувати, майстра — звільнити, ціну — змінити. Клієнт має отримати
 * те, на що він погоджувався, а не поточний стан довідників.
 */
type ReminderPayload = {
  clientName?: string;
  phone?: string | null;
  email?: string | null;
  service?: string;
  employee?: string;
  startAt?: string;
  endAt?: string;
  businessName?: string;
  address?: string | null;
  mapsUrl?: string | null;
  businessPhone?: string | null;
  timezone?: string;
  priceLabel?: string | null;
};

export async function scheduleAppointmentReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          address: true,
          mapsUrl: true,
          phone: true,
          timezone: true,
          currency: true,
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

  const payload: ReminderPayload = {
    clientName: [appointment.client.firstName, appointment.client.lastName]
      .filter(Boolean)
      .join(" "),
    phone: appointment.client.phone,
    email: appointment.client.email,
    service: appointment.service.name,
    employee: appointment.employee.name,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    businessName: org.name,
    address: org.address,
    mapsUrl: org.mapsUrl,
    businessPhone: org.phone,
    timezone: org.timezone,
    priceLabel: appointment.priceCents
      ? formatMoney(appointment.priceCents, org.currency)
      : null,
  };

  await prisma.reminderJob.createMany({
    data: channels.map((channel) => ({
      organizationId: org.id,
      appointmentId,
      channel,
      scheduledFor,
      payload,
    })),
  });
}

export async function cancelAppointmentReminders(appointmentId: string) {
  await prisma.reminderJob.updateMany({
    where: { appointmentId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

async function deliverInApp(job: {
  id: string;
  organizationId: string;
  appointmentId: string;
  payload: ReminderPayload;
}) {
  await prisma.notification.create({
    data: {
      organizationId: job.organizationId,
      type: "APPOINTMENT_REMINDER",
      title: "Нагадування про запис",
      body: `${job.payload.clientName ?? "Клієнт"} — ${job.payload.service ?? "послуга"}`,
      entityType: "appointment",
      entityId: job.appointmentId,
    },
  });
}

async function deliverEmail(payload: ReminderPayload) {
  if (!payload.email) throw new Error("У клієнта немає email");
  if (!payload.startAt) throw new Error("У задачі немає часу запису");

  const mail = appointmentReminderEmail({
    businessName: payload.businessName ?? "Салон",
    clientName: payload.clientName ?? "",
    service: payload.service ?? "Послуга",
    employee: payload.employee ?? "",
    startAt: new Date(payload.startAt),
    appUrl: appUrl(),
    address: payload.address,
    mapsUrl: payload.mapsUrl,
    phone: payload.businessPhone,
    priceLabel: payload.priceLabel,
  });

  const result = await sendMail({ to: payload.email, ...mail });
  // `channel: "log"` — пошта не налаштована. Це не помилка доставки:
  // задачу треба закрити, інакше вона висітиме в черзі вічно.
  if (result.error) throw new Error(result.error);
}

/**
 * Скільки чекати, перш ніж вважати задачу в SENDING покинутою.
 *
 * Процес міг померти між «забрав задачу» і «позначив надісланою» — на
 * Vercel це просто вичерпаний ліміт часу функції. Без цього повернення
 * задача застрягла б у SENDING назавжди.
 */
const STALE_MINUTES = 10;

/** Повертає в чергу задачі, покинуті процесом, який не дожив до кінця. */
async function reclaimStale(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const { count } = await prisma.reminderJob.updateMany({
    where: { status: "SENDING", updatedAt: { lt: cutoff } },
    data: { status: "PENDING" },
  });
  if (count > 0) console.warn(`[reminders] повернуто в чергу зависло: ${count}`);
  return count;
}

/**
 * Забирає з черги все, чий час настав, і доставляє.
 *
 * Кожна задача спершу АТОМАРНО забирається: `updateMany` з умовою
 * `status: PENDING` переводить її в SENDING і повертає кількість
 * оновлених рядків. Нуль означає, що задачу вже забрав інший запуск —
 * тоді ми її пропускаємо. Без цього два планувальники (або ручний виклик
 * під час планового) надіслали б клієнту одне нагадування двічі.
 *
 * Помилка однієї задачі не зупиняє решту, і після MAX_ATTEMPTS невдач
 * задача переходить у FAILED, щоб не крутитися в черзі нескінченно.
 * Раніше саме це й відбувалося з непідтриманими каналами: вони лише
 * збільшували лічильник і поверталися на наступному запуску.
 */
export async function dispatchDueReminders(limit = 50) {
  await reclaimStale();

  const due = await prisma.reminderJob.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    take: limit,
    orderBy: { scheduledFor: "asc" },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of due) {
    const claim = await prisma.reminderJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "SENDING" },
    });
    if (claim.count === 0) {
      skipped++;
      continue;
    }

    const payload = (job.payload ?? {}) as ReminderPayload;
    const attempts = job.attempts + 1;

    try {
      if (!DELIVERABLE.includes(job.channel)) {
        throw new Error(`Канал ${job.channel} ще не підключено`);
      }

      if (job.channel === "IN_APP") {
        await deliverInApp({ ...job, payload });
      } else {
        await deliverEmail(payload);
      }

      await prisma.reminderJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date(), attempts, error: null },
      });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const exhausted = attempts >= MAX_ATTEMPTS;
      await prisma.reminderJob.update({
        where: { id: job.id },
        // Не вичерпані спроби повертаються в PENDING — інакше задача
        // лишилася б у SENDING і чекала на reclaimStale зайві 10 хвилин.
        data: { status: exhausted ? "FAILED" : "PENDING", attempts, error: message },
      });
      if (exhausted) failed++;
      console.error(`[reminders] ${job.channel} ${job.id}: ${message} (спроба ${attempts})`);
    }
  }

  return { picked: due.length, sent, failed, skipped };
}

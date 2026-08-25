import "server-only";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/mail";
import { appointmentConfirmationEmail } from "@/lib/mail/templates";
import { buildIcs } from "@/lib/calendar-file";
import { appUrl } from "@/lib/app-url";
import { wallClockToUtc } from "@/lib/wall-clock";
import { formatMoney } from "@/lib/money";

/** Показуємо в логах, кому пішов лист, не виписуючи адресу цілком. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  const name = email.slice(0, at);
  return `${name.slice(0, 2)}***${email.slice(at)}`;
}

/**
 * Лист-підтвердження після онлайн-запису.
 *
 * Людина щойно залишила свій email на сайті салону — мовчання у відповідь
 * читається як «форма не спрацювала», і за півгодини салону телефонують
 * уточнити. Лист закриває це питання і заразом кладе візит у календар
 * клієнта вкладеним .ics.
 *
 * `to` — адреса, введена САМЕ В ЦЬОМУ бронюванні, і вона має перевагу над
 * адресою в картці клієнта. Причина: клієнта знаходять за телефоном, і
 * якщо в картці вже лежить стара пошта (записував адміністратор, змінилася
 * адреса, телефон спільний на родину), лист пішов би не тому, хто щойно
 * заповнив форму. Саму картку при цьому не переписуємо: публічна форма не
 * повинна мовчки правити дані, які веде салон.
 *
 * НІКОЛИ не кидає виняток. Запис уже створено; невдала пошта не має
 * скасовувати бронювання чи показувати клієнту помилку. Той самий принцип,
 * що й в автоматизаціях: побічна дія не ламає основну.
 */
export async function sendAppointmentConfirmation(
  appointmentId: string,
  options?: { to?: string | null },
): Promise<void> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        priceCents: true,
        status: true,
        client: { select: { firstName: true, lastName: true, email: true } },
        service: { select: { name: true } },
        employee: { select: { name: true } },
        organization: {
          select: {
            name: true,
            address: true,
            mapsUrl: true,
            phone: true,
            timezone: true,
            currency: true,
            slug: true,
          },
        },
      },
    });

    const email = options?.to?.trim() || appointment?.client.email;
    if (!appointment || !email) {
      // Найчастіша причина «лист не прийшов» — його й не було кому слати.
      console.log(`[booking] ${appointmentId}: підтвердження не надсилали — немає email`);
      return;
    }

    const { organization, service, employee, client } = appointment;
    const base = appUrl();

    const mail = appointmentConfirmationEmail({
      businessName: organization.name,
      clientName: [client.firstName, client.lastName].filter(Boolean).join(" "),
      service: service.name,
      employee: employee.name,
      startAt: appointment.startAt,
      appUrl: base,
      address: organization.address,
      mapsUrl: organization.mapsUrl,
      phone: organization.phone,
      priceLabel: appointment.priceCents
        ? formatMoney(appointment.priceCents, organization.currency)
        : null,
      confirmed: appointment.status !== "WAITING",
    });

    const ics = buildIcs({
      uid: `${appointment.id}@crm.factory`,
      // У календар клієнта йде справжній момент, а не настінний годинник:
      // інакше подія стане на три години пізніше за реальний візит.
      start: wallClockToUtc(appointment.startAt, organization.timezone),
      end: wallClockToUtc(appointment.endAt, organization.timezone),
      summary: `${service.name} — ${organization.name}`,
      description: [
        `Майстер: ${employee.name}`,
        organization.phone ? `Телефон салону: ${organization.phone}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      location: organization.address ?? undefined,
      url: `${base}/book/${organization.slug}`,
    });

    const result = await sendMail({
      to: email,
      ...mail,
      attachments: [
        {
          filename: "zapys.ics",
          content: Buffer.from(ics, "utf8").toString("base64"),
          contentType: "text/calendar",
        },
      ],
    });

    if (result.error) {
      console.error(`[booking] підтвердження на ${maskEmail(email)} НЕ пішло: ${result.error}`);
    } else if (result.channel === "log") {
      console.warn(`[booking] підтвердження для ${maskEmail(email)} лише в лог — RESEND_API_KEY не задано`);
    } else {
      console.log(`[booking] підтвердження надіслано на ${maskEmail(email)}`);
    }
  } catch (error) {
    console.error("[booking] не вдалося надіслати підтвердження", error);
  }
}

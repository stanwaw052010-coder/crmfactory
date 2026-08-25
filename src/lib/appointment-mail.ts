import "server-only";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/mail";
import { appointmentConfirmationEmail } from "@/lib/mail/templates";
import { buildIcs } from "@/lib/calendar-file";
import { appUrl } from "@/lib/app-url";
import { wallClockToUtc } from "@/lib/wall-clock";
import { formatMoney } from "@/lib/money";

/**
 * Лист-підтвердження після онлайн-запису.
 *
 * Людина щойно залишила свій email на сайті салону — мовчання у відповідь
 * читається як «форма не спрацювала», і за півгодини салону телефонують
 * уточнити. Лист закриває це питання і заразом кладе візит у календар
 * клієнта вкладеним .ics.
 *
 * НІКОЛИ не кидає виняток. Запис уже створено; невдала пошта не має
 * скасовувати бронювання чи показувати клієнту помилку. Той самий принцип,
 * що й в автоматизаціях: побічна дія не ламає основну.
 */
export async function sendAppointmentConfirmation(appointmentId: string): Promise<void> {
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

    const email = appointment?.client.email;
    if (!appointment || !email) return;

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

    await sendMail({
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
  } catch (error) {
    console.error("[booking] не вдалося надіслати підтвердження", error);
  }
}

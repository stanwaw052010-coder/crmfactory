import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildIcs } from "@/lib/calendar-file";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Файл візиту для календаря клієнта.
 *
 * Доступ — за знанням id запису (cuid, 25 символів). Це capability-URL:
 * посилання отримує той, хто щойно сам зробив бронювання. Тому у файлі
 * НЕМАЄ персональних даних клієнта — лише те, що він і так щойно ввів
 * сам: послуга, майстер, час, салон. Так навіть витік посилання нікого
 * не розкриває.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Довгі рядки відсікаємо до звернення в БД.
  if (!id || id.length > 40) {
    return new NextResponse("Not found", { status: 404 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      priceCents: true,
      status: true,
      service: { select: { name: true } },
      employee: { select: { name: true } },
      organization: {
        select: { name: true, address: true, phone: true, currency: true, slug: true },
      },
    },
  });

  if (!appointment || appointment.status === "CANCELLED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { organization, service, employee } = appointment;

  const description = [
    `Майстер: ${employee.name}`,
    `Вартість: ${formatMoney(appointment.priceCents, organization.currency)}`,
    organization.phone ? `Телефон салону: ${organization.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const ics = buildIcs({
    uid: `${appointment.id}@crm.factory`,
    start: appointment.startAt,
    end: appointment.endAt,
    summary: `${service.name} — ${organization.name}`,
    description,
    location: organization.address ?? undefined,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="visit-${appointment.id}.ics"`,
      // Час візиту може змінитися — кешувати такий файл не можна.
      "Cache-Control": "no-store",
    },
  });
}

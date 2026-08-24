import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { BookingFlow } from "@/features/booking/booking-flow";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { name: true, about: true },
  });
  if (!organization) return { title: "Сторінку не знайдено" };
  return {
    title: `Онлайн-запис — ${organization.name}`,
    description: organization.about ?? `Записатися онлайн у ${organization.name}`,
  };
}

export default async function PublicBookingPage({ params }: { params: Params }) {
  const { slug } = await params;

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      about: true,
      phone: true,
      address: true,
      logoUrl: true,
      brandColor: true,
      currency: true,
      bookingEnabled: true,
      bookingRequireEmail: true,
      bookingWelcomeText: true,
      bookingHorizonDays: true,
    },
  });
  if (!organization) notFound();

  // Публічно віддаємо лише те, що справді доступне для запису.
  const [services, employees] = await Promise.all([
    prisma.service.findMany({
      where: { organizationId: organization.id, isActive: true, onlineBooking: true },
      include: {
        category: { select: { id: true, name: true } },
        employees: { select: { employeeId: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: { organizationId: organization.id, isActive: true, acceptsOnlineBooking: true },
      select: { id: true, name: true, position: true, color: true, avatarUrl: true, bio: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <BookingFlow
      organization={{
        name: organization.name,
        slug: organization.slug,
        about: organization.about,
        phone: organization.phone,
        address: organization.address,
        logoUrl: organization.logoUrl,
        brandColor: organization.brandColor,
        currency: organization.currency,
        enabled: organization.bookingEnabled,
        requireEmail: organization.bookingRequireEmail,
        welcomeText: organization.bookingWelcomeText,
        horizonDays: organization.bookingHorizonDays,
      }}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMin: service.durationMin,
        priceCents: service.priceCents,
        color: service.color,
        categoryName: service.category?.name ?? null,
        employeeIds: service.employees.map((e) => e.employeeId),
      }))}
      employees={employees}
    />
  );
}

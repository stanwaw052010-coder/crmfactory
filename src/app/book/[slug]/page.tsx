import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { listPublicReviews } from "@/server/queries/reviews";
import { listMedia } from "@/server/media";
import { venueMapUrl } from "@/lib/maps";
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
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      mapsUrl: true,
    },
  });
  if (!organization) notFound();

  // Публічно віддаємо лише те, що справді доступне для запису.
  const [services, employees, gallery, hours, reviews] = await Promise.all([
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
    listMedia(organization.id, "GALLERY"),
    prisma.businessHours.findMany({
      where: { organizationId: organization.id },
      select: { weekday: true, openMinute: true, closeMinute: true, isClosed: true },
      orderBy: { weekday: "asc" },
    }),
    listPublicReviews(organization.id),
  ]);

  // Середня — тільки за опублікованими: показувати «4.8» під списком із
  // трьох відгуків, порахувавши її по всіх, включно з прихованими, було б
  // тихою неправдою на публічній сторінці.
  const reviewAverage =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return (
    <BookingFlow
      reviews={reviews.map((review) => ({
        ...review,
        submittedAt: review.submittedAt.toISOString(),
      }))}
      reviewAverage={reviewAverage}
      reviewCount={reviews.length}
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
        instagramUrl: organization.instagramUrl,
        facebookUrl: organization.facebookUrl,
        tiktokUrl: organization.tiktokUrl,
        mapUrl: venueMapUrl(organization),
      }}
      gallery={gallery.map((photo) => ({ id: photo.id, url: photo.url }))}
      hours={hours}
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

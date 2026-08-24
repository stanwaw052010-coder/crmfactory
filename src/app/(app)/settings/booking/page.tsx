import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { BookingForm } from "@/features/settings/booking-form";

export const metadata: Metadata = { title: "Онлайн-запис" };

export default async function BookingSettingsPage() {
  const ctx = await requireViewPermission("settings.view");
  const [organization, businessHours] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization.id } }),
    prisma.businessHours.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { weekday: "asc" },
    }),
  ]);

  return (
    <BookingForm
      organization={organization}
      businessHours={businessHours}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
      canManage={ctx.permissions.has("settings.manage")}
    />
  );
}

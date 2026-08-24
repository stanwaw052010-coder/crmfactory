import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { BusinessForm } from "@/features/settings/business-form";

export const metadata: Metadata = { title: "Налаштування бізнесу" };

export default async function SettingsPage() {
  const ctx = await requireViewPermission("settings.view");
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organization.id },
  });

  return (
    <BusinessForm
      organization={organization}
      canManage={ctx.permissions.has("settings.manage")}
    />
  );
}

import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { NotificationsForm } from "@/features/settings/notifications-form";
import { parseChannels } from "@/lib/reminders";

export const metadata: Metadata = { title: "Сповіщення" };

export default async function NotificationsSettingsPage() {
  const ctx = await requireViewPermission("settings.manage");
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organization.id },
    select: { reminderEnabled: true, reminderHoursBefore: true, reminderChannels: true },
  });

  const pending = await prisma.reminderJob.count({
    where: { organizationId: ctx.organization.id, status: "PENDING" },
  });

  return (
    <NotificationsForm
      settings={{
        reminderEnabled: organization.reminderEnabled,
        reminderHoursBefore: organization.reminderHoursBefore,
        channels: parseChannels(organization.reminderChannels),
      }}
      pendingReminders={pending}
    />
  );
}

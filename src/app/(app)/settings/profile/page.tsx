import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { ProfileForm } from "@/features/settings/profile-form";

export const metadata: Metadata = { title: "Мій профіль" };

export default async function ProfilePage() {
  const ctx = await requireAuth();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { name: true, email: true, phone: true },
  });

  return (
    <ProfileForm user={user} role={ctx.membership.role} organizationName={ctx.organization.name} />
  );
}

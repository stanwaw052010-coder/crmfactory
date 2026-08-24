import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { TeamManager } from "@/features/settings/team-manager";

export const metadata: Metadata = { title: "Команда і доступи" };

export default async function TeamSettingsPage() {
  const ctx = await requireViewPermission("team.manage");

  const [memberships, employees] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        employee: { select: { name: true } },
        overrides: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.employee.findMany({
      where: { organizationId: ctx.organization.id },
      include: { membership: { select: { id: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <TeamManager
      currentRole={ctx.membership.role}
      members={memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl,
        employeeName: membership.employee?.name ?? null,
        overrides: Object.fromEntries(membership.overrides.map((o) => [o.permission, o.allowed])),
        isSelf: membership.id === ctx.membership.id,
      }))}
      employees={employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        hasUser: Boolean(employee.membership),
      }))}
    />
  );
}

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandMenu } from "@/components/layout/command-menu";
import { PageTransition } from "@/components/layout/page-transition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();

  // Незавершений онбординг веде на майстер налаштування, а не в порожній CRM.
  if (!ctx.organization.onboardingCompleted) redirect("/onboarding");

  const notifications = await prisma.notification.findMany({
    where: {
      organizationId: ctx.organization.id,
      OR: [{ userId: null }, { userId: ctx.user.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const permissions = Array.from(ctx.permissions);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar
        user={{
          name: ctx.user.name,
          email: ctx.user.email,
          avatarUrl: ctx.user.avatarUrl,
          isSuperAdmin: ctx.user.isSuperAdmin,
        }}
        organization={{
          id: ctx.organization.id,
          name: ctx.organization.name,
          logoUrl: ctx.organization.logoUrl,
          plan: ctx.organization.plan,
        }}
        organizations={ctx.organizations.map((o) => ({
          id: o.id,
          name: o.name,
          logoUrl: o.logoUrl,
        }))}
        role={ctx.membership.role}
        permissions={permissions}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          notifications={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            entityType: n.entityType,
            entityId: n.entityId,
            readAt: n.readAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
          }))}
          bookingUrl={`${appUrl}/book/${ctx.organization.slug}`}
          canCreateAppointment={ctx.permissions.has("appointment.create")}
        />

        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <MobileNav permissions={permissions} />
      <CommandMenu permissions={permissions} />
    </div>
  );
}

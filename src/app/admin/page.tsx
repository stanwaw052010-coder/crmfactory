import type { Metadata } from "next";
import { Building2, CalendarCheck2, TrendingUp, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { PLAN_PRICE_CENTS } from "@/lib/plans";
import { OrganizationsTable } from "@/features/admin/organizations-table";
import { MailStatusCard } from "@/features/admin/mail-status";
import { mailStatus } from "@/lib/mail";
import { addDays, relativeUk } from "@/lib/time";

export const metadata: Metadata = { title: "Super Admin" };



export default async function AdminPage() {
  const superAdmin = await requireSuperAdmin();
  const monthAgo = addDays(new Date(), -30);
  const mail = mailStatus();

  const [
    organizations,
    userCount,
    appointmentCount,
    subscriptions,
    recentOrganizations,
    activeUsers,
    recentLogs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.appointment.count(),
    prisma.subscription.groupBy({
      by: ["plan"],
      _count: { _all: true },
      _sum: { priceCents: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        subscription: { select: { plan: true, status: true, trialEndsAt: true } },
        memberships: {
          where: { role: "OWNER" },
          take: 1,
          select: { user: { select: { email: true } } },
        },
        _count: { select: { memberships: true, clients: true, appointments: true } },
      },
    }),
    prisma.user.count({ where: { lastLoginAt: { gte: monthAgo } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);

  // MRR — сума реальних цін підписок, а не прайс-лист помножений на кількість.
  // Безкоштовний Pro, виданий на тест, має priceCents = 0 і виручку не роздуває.
  const mrrCents = subscriptions.reduce((sum, row) => sum + (row._sum.priceCents ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="mb-6">
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
          Панель платформи
        </h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--fg-muted)]">
          Стан crm.factory: організації, користувачі, підписки та активність.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всього бізнесів" value={organizations} icon={Building2} tone="brand" />
        <StatCard
          label="Активних користувачів"
          value={activeUsers}
          hint={`із ${userCount} усього`}
          icon={Users}
          tone="info"
        />
        <StatCard label="Записів у системі" value={appointmentCount} icon={CalendarCheck2} tone="success" />
        <StatCard label="MRR" value={formatMoney(mrrCents, "EUR")} icon={TrendingUp} tone="success" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {(["FREE", "STARTER", "BUSINESS", "PRO"] as const).map((plan) => {
          const row = subscriptions.find((s) => s.plan === plan);
          return (
            <div key={plan} className="card p-4">
              <p className="text-[12px] text-[var(--fg-subtle)]">{plan}</p>
              <p className="mt-1 text-[22px] font-semibold text-[var(--fg)] tabular-nums">
                {row?._count._all ?? 0}
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--fg-subtle)]">
                {formatMoney(PLAN_PRICE_CENTS[plan], "EUR")}/міс
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <OrganizationsTable
          organizations={recentOrganizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logoUrl: organization.logoUrl,
            createdAt: organization.createdAt,
            plan: organization.subscription?.plan ?? "FREE",
            status: organization.subscription?.status ?? "TRIALING",
            trialEndsAt: organization.subscription?.trialEndsAt ?? null,
            ownerEmail: organization.memberships[0]?.user.email ?? null,
            members: organization._count.memberships,
            clients: organization._count.clients,
            appointments: organization._count.appointments,
          }))}
        />

        <div className="space-y-6">
        <MailStatusCard
          configured={mail.configured}
          from={mail.from}
          sandboxSender={mail.sandboxSender}
          senderValid={mail.senderValid}
          senderDomain={mail.senderDomain}
          keyIssue={mail.keyIssue}
          defaultTo={superAdmin.email}
        />

        <Card>
          <CardHeader title="Системний журнал" description="Останні дії в платформі" />
          {recentLogs.length === 0 ? (
            <EmptyState compact icon={Users} title="Подій ще немає" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recentLogs.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <p className="text-[13px] font-medium text-[var(--fg)]">{log.action}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--fg-muted)]">
                    {log.user?.name ?? "Гість"}
                    {log.organization && ` · ${log.organization.name}`}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--fg-subtle)]">
                    {relativeUk(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}

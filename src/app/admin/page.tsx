import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarCheck2, TrendingUp, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { addDays, formatDateUk, relativeUk } from "@/lib/time";

export const metadata: Metadata = { title: "Super Admin" };

const PLAN_PRICES: Record<string, number> = { FREE: 0, STARTER: 1900, BUSINESS: 3900, PRO: 7900 };

export default async function AdminPage() {
  await requireSuperAdmin();
  const monthAgo = addDays(new Date(), -30);

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
    prisma.subscription.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        subscription: { select: { plan: true, status: true } },
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

  // MRR рахуємо з платних підписок за прайсом тарифів.
  const mrrCents = subscriptions.reduce(
    (sum, row) => sum + (PLAN_PRICES[row.plan] ?? 0) * row._count._all,
    0,
  );

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
                {formatMoney(PLAN_PRICES[plan], "EUR")}/міс
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <CardHeader title="Організації" description="Останні зареєстровані бізнеси" />
          {recentOrganizations.length === 0 ? (
            <EmptyState icon={Building2} title="Організацій ще немає" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    {["Бізнес", "Тариф", "Команда", "Клієнти", "Записи", "Створено"].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {recentOrganizations.map((organization) => (
                    <tr key={organization.id} className="transition-colors hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={organization.name} src={organization.logoUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium text-[var(--fg)]">
                              {organization.name}
                            </p>
                            <Link
                              href={`/book/${organization.slug}`}
                              className="truncate text-[11.5px] text-[var(--fg-subtle)] hover:text-[var(--primary)]"
                            >
                              /book/{organization.slug}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={organization.subscription?.plan === "FREE" ? "neutral" : "brand"}>
                          {organization.subscription?.plan ?? "FREE"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)] tabular-nums">
                        {organization._count.memberships}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)] tabular-nums">
                        {organization._count.clients}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)] tabular-nums">
                        {organization._count.appointments}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--fg-subtle)]">
                        {formatDateUk(organization.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

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
  );
}

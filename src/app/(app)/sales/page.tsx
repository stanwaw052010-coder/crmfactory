import type { Metadata } from "next";
import { CalendarRange, TrendingUp, Wallet } from "lucide-react";
import type { PaymentStatus } from "@prisma/client";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SalesTable } from "@/features/sales/sales-table";
import { formatMoney } from "@/lib/money";
import { startOfDay, startOfWeek } from "@/lib/time";

export const metadata: Metadata = { title: "Продажі" };

const PAGE_SIZE = 25;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ctx = await requireViewPermission("payment.view");

  const status = typeof params.status === "string" ? params.status : "ALL";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const where = {
    organizationId: ctx.organization.id,
    ...(status !== "ALL" ? { status: status as PaymentStatus } : {}),
  };

  const [today, week, month, prevMonth, total, payments, clients, employees] = await Promise.all([
    prisma.payment.aggregate({
      where: { organizationId: ctx.organization.id, status: "PAID", paidAt: { gte: todayStart } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId: ctx.organization.id, status: "PAID", paidAt: { gte: weekStart } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId: ctx.organization.id, status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId: ctx.organization.id,
        status: "PAID",
        paidAt: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        employee: { select: { id: true, name: true } },
        appointment: { select: { service: { select: { name: true } } } },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.findMany({
      where: { organizationId: ctx.organization.id },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
      take: 300,
    }),
    prisma.employee.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currency = ctx.organization.currency;
  const monthCents = month._sum.amountCents ?? 0;
  const prevMonthCents = prevMonth._sum.amountCents ?? 0;
  const monthDelta =
    prevMonthCents > 0 ? Math.round(((monthCents - prevMonthCents) / prevMonthCents) * 100) : null;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Продажі"
        description="Оплати за записами й ручні продажі — уся виручка в одному місці."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Сьогодні"
          value={formatMoney(today._sum.amountCents ?? 0, currency)}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Цей тиждень"
          value={formatMoney(week._sum.amountCents ?? 0, currency)}
          icon={CalendarRange}
          tone="info"
        />
        <StatCard
          label="Цей місяць"
          value={formatMoney(monthCents, currency)}
          delta={monthDelta}
          hint="проти минулого місяця"
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <SalesTable
        rows={payments.map((payment) => ({
          id: payment.id,
          paidAt: payment.paidAt,
          amountCents: payment.amountCents,
          method: payment.method,
          status: payment.status,
          note: payment.note,
          client: payment.client,
          employee: payment.employee,
          service: payment.appointment?.service ?? null,
        }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        status={status}
        currency={currency}
        canManage={ctx.permissions.has("payment.manage")}
        clients={clients}
        employees={employees}
      />
    </div>
  );
}

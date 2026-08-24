import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, Percent, Wallet } from "lucide-react";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentStatusBadge } from "@/components/shared/status";
import { ScheduleEditor } from "@/features/employees/schedule-editor";
import { formatMoney } from "@/lib/money";
import { addDays, formatDateUk, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Співробітник" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireViewPermission("employee.view");
  const from = addDays(new Date(), -30);

  const employee = await prisma.employee.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      schedules: true,
      exceptions: { orderBy: { date: "asc" } },
      services: { include: { service: { select: { id: true, name: true, color: true } } } },
    },
  });
  if (!employee) notFound();

  const [upcoming, stats, revenue, statusGroups] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: ctx.organization.id,
        employeeId: id,
        startAt: { gte: new Date() },
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { name: true, color: true } },
      },
      orderBy: { startAt: "asc" },
      take: 10,
    }),
    prisma.appointment.count({
      where: {
        organizationId: ctx.organization.id,
        employeeId: id,
        startAt: { gte: from },
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId: ctx.organization.id,
        employeeId: id,
        status: "PAID",
        paidAt: { gte: from },
      },
      _sum: { amountCents: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organization.id, employeeId: id, startAt: { gte: from } },
      _count: { _all: true },
    }),
  ]);

  const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const cancelled = statusGroups.find((g) => g.status === "CANCELLED")?._count._all ?? 0;
  const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  // Свій графік може редагувати сам співробітник; чужий — лише керівництво.
  const canEditSchedule =
    ctx.permissions.has("schedule.manage") ||
    (ctx.permissions.has("schedule.manage_own") && ctx.membership.employeeId === id);

  const days = Array.from({ length: 7 }, (_, weekday) => {
    const found = employee.schedules.find((s) => s.weekday === weekday);
    return (
      found ?? {
        weekday,
        isDayOff: weekday === 0,
        startMinute: 540,
        endMinute: 1080,
        breakStart: null,
        breakEnd: null,
      }
    );
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Вся команда
      </Link>

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={employee.name} src={employee.avatarUrl} color={employee.color} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
                  {employee.name}
                </h1>
                {!employee.isActive && <Badge tone="neutral">Неактивний</Badge>}
                {employee.acceptsOnlineBooking && (
                  <Badge tone="success" dot>
                    Приймає онлайн-записи
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
                {employee.position ?? "Співробітник"}
                {employee.phone && ` · ${employee.phone}`}
                {employee.email && ` · ${employee.email}`}
              </p>
              {employee.bio && (
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--fg-muted)]">
                  {employee.bio}
                </p>
              )}
              {employee.services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {employee.services.map(({ service }) => (
                    <Badge key={service.id} tone="neutral">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: service.color }}
                        aria-hidden
                      />
                      {service.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Записів за 30 днів" value={stats} icon={CalendarCheck2} tone="brand" />
        <StatCard
          label="Виручка за 30 днів"
          value={formatMoney(revenue._sum.amountCents ?? 0, ctx.organization.currency)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Рівень скасувань"
          value={`${cancellationRate}%`}
          icon={Percent}
          tone={cancellationRate > 20 ? "danger" : "info"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ScheduleEditor
          employeeId={employee.id}
          days={days}
          exceptions={employee.exceptions}
          canEdit={canEditSchedule}
        />

        <Card className="h-fit">
          <CardHeader title="Найближчі записи" />
          {upcoming.length === 0 ? (
            <EmptyState compact icon={CalendarCheck2} title="Записів попереду немає" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {upcoming.map((appointment) => (
                <li key={appointment.id} className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: appointment.service.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/clients/${appointment.client.id}`}
                        className="block truncate text-[13.5px] font-medium text-[var(--fg)] hover:text-[var(--primary)]"
                      >
                        {appointment.client.firstName} {appointment.client.lastName ?? ""}
                      </Link>
                      <p className="truncate text-[12px] text-[var(--fg-muted)]">
                        {appointment.service.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12.5px] font-medium text-[var(--fg)]">
                        {formatDateUk(appointment.startAt)}
                      </p>
                      <p className="text-[11.5px] text-[var(--fg-subtle)] tabular-nums">
                        {formatTime(appointment.startAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pl-3.5">
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

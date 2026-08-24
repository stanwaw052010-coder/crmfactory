import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeesGrid } from "@/features/employees/employees-grid";
import { addDays } from "@/lib/time";

export const metadata: Metadata = { title: "Команда" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ctx = await requireViewPermission("employee.view");
  const weekday = new Date().getDay();
  const from = addDays(new Date(), -30);

  const [employees, services, appointmentStats, revenueStats] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        services: { select: { serviceId: true } },
        schedules: { where: { weekday } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.service.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.appointment.groupBy({
      by: ["employeeId"],
      where: {
        organizationId: ctx.organization.id,
        startAt: { gte: from },
        status: { notIn: ["CANCELLED"] },
      },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["employeeId"],
      where: { organizationId: ctx.organization.id, status: "PAID", paidAt: { gte: from } },
      _sum: { amountCents: true },
    }),
  ]);

  const appointmentMap = new Map(appointmentStats.map((r) => [r.employeeId, r._count._all]));
  const revenueMap = new Map(revenueStats.map((r) => [r.employeeId, r._sum.amountCents ?? 0]));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Команда"
        description="Графіки, послуги та результати кожного співробітника."
      />
      <EmployeesGrid
        currency={ctx.organization.currency}
        canManage={ctx.permissions.has("employee.manage")}
        services={services}
        openNew={params.new === "1"}
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          position: employee.position,
          email: employee.email,
          phone: employee.phone,
          color: employee.color,
          bio: employee.bio,
          isActive: employee.isActive,
          acceptsOnlineBooking: employee.acceptsOnlineBooking,
          avatarUrl: employee.avatarUrl,
          serviceIds: employee.services.map((s) => s.serviceId),
          serviceCount: employee.services.length,
          appointments: appointmentMap.get(employee.id) ?? 0,
          revenueCents: revenueMap.get(employee.id) ?? 0,
          today: employee.schedules[0]
            ? {
                isDayOff: employee.schedules[0].isDayOff,
                startMinute: employee.schedules[0].startMinute,
                endMinute: employee.schedules[0].endMinute,
              }
            : null,
        }))}
      />
    </div>
  );
}

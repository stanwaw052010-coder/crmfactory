import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays, startOfDay, endOfDay } from "@/lib/time";
import { RANGE_DAYS, type AnalyticsRange } from "@/lib/analytics-range";

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;

/**
 * Аналітика за період + порівняння з попереднім таким самим періодом.
 * Групування по днях/тижнях/місяцях залежно від довжини діапазону,
 * щоб графік лишався читабельним і на 7 днях, і на році.
 */
export async function getAnalytics(organizationId: string, range: AnalyticsRange) {
  const days = RANGE_DAYS[range];
  const now = new Date();
  const from = startOfDay(addDays(now, -(days - 1)));
  const to = endOfDay(now);
  const prevFrom = startOfDay(addDays(from, -days));
  const prevTo = endOfDay(addDays(from, -1));

  const [
    payments,
    prevPayments,
    appointments,
    prevAppointments,
    newClients,
    prevNewClients,
    employees,
    services,
    statusGroups,
    prevStatusGroups,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { organizationId, status: "PAID", paidAt: { gte: from, lte: to } },
      select: { amountCents: true, paidAt: true, employeeId: true, clientId: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId, status: "PAID", paidAt: { gte: prevFrom, lte: prevTo } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.appointment.findMany({
      where: { organizationId, startAt: { gte: from, lte: to } },
      select: {
        startAt: true,
        status: true,
        clientId: true,
        serviceId: true,
        employeeId: true,
        priceCents: true,
      },
    }),
    prisma.appointment.count({
      where: { organizationId, startAt: { gte: prevFrom, lte: prevTo }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.client.count({ where: { organizationId, createdAt: { gte: from, lte: to } } }),
    prisma.client.count({ where: { organizationId, createdAt: { gte: prevFrom, lte: prevTo } } }),
    prisma.employee.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, color: true, position: true },
    }),
    prisma.service.findMany({
      where: { organizationId },
      select: { id: true, name: true, color: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { organizationId, startAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { organizationId, startAt: { gte: prevFrom, lte: prevTo } },
      _count: { _all: true },
    }),
  ]);

  // Гранулярність графіка
  const granularity: "day" | "week" | "month" =
    days <= 31 ? "day" : days <= 120 ? "week" : "month";

  const bucketKey = (date: Date) => {
    if (granularity === "day") return date.toISOString().slice(0, 10);
    if (granularity === "week") {
      const monday = new Date(date);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      return monday.toISOString().slice(0, 10);
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const revenueBuckets = new Map<string, number>();
  const appointmentBuckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const key = bucketKey(addDays(from, i));
    revenueBuckets.set(key, 0);
    appointmentBuckets.set(key, 0);
  }
  for (const payment of payments) {
    const key = bucketKey(payment.paidAt);
    if (revenueBuckets.has(key)) revenueBuckets.set(key, revenueBuckets.get(key)! + payment.amountCents);
  }
  for (const appointment of appointments) {
    if (appointment.status === "CANCELLED") continue;
    const key = bucketKey(appointment.startAt);
    if (appointmentBuckets.has(key)) appointmentBuckets.set(key, appointmentBuckets.get(key)! + 1);
  }

  const revenueCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const prevRevenueCents = prevPayments._sum.amountCents ?? 0;
  const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const cancelled = statusGroups.find((g) => g.status === "CANCELLED")?._count._all ?? 0;
  const noShow = statusGroups.find((g) => g.status === "NO_SHOW")?._count._all ?? 0;
  const completed = statusGroups.find((g) => g.status === "COMPLETED")?._count._all ?? 0;
  const prevTotal = prevStatusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const prevCancelled = prevStatusGroups.find((g) => g.status === "CANCELLED")?._count._all ?? 0;

  // Нові vs повторні: клієнт вважається повторним, якщо в періоді
  // це не перший його візит.
  const visitsByClient = new Map<string, number>();
  for (const appointment of appointments) {
    if (appointment.status === "CANCELLED") continue;
    visitsByClient.set(appointment.clientId, (visitsByClient.get(appointment.clientId) ?? 0) + 1);
  }
  const returningClients = Array.from(visitsByClient.values()).filter((v) => v > 1).length;

  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const revenueByEmployee = new Map<string, { revenue: number; count: number }>();
  for (const payment of payments) {
    if (!payment.employeeId) continue;
    const entry = revenueByEmployee.get(payment.employeeId) ?? { revenue: 0, count: 0 };
    entry.revenue += payment.amountCents;
    revenueByEmployee.set(payment.employeeId, entry);
  }
  for (const appointment of appointments) {
    if (appointment.status === "CANCELLED") continue;
    const entry = revenueByEmployee.get(appointment.employeeId) ?? { revenue: 0, count: 0 };
    entry.count += 1;
    revenueByEmployee.set(appointment.employeeId, entry);
  }

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const byService = new Map<string, { count: number; revenue: number }>();
  for (const appointment of appointments) {
    if (appointment.status === "CANCELLED") continue;
    const entry = byService.get(appointment.serviceId) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += appointment.priceCents;
    byService.set(appointment.serviceId, entry);
  }

  const paidCount = payments.length;

  return {
    range,
    granularity,
    revenueSeries: Array.from(revenueBuckets.entries()).map(([date, cents]) => ({
      date,
      revenue: cents / 100,
    })),
    appointmentSeries: Array.from(appointmentBuckets.entries()).map(([date, count]) => ({
      date,
      appointments: count,
    })),
    totals: {
      revenueCents,
      prevRevenueCents,
      appointments: total - cancelled,
      prevAppointments,
      newClients,
      prevNewClients,
      returningClients,
      completed,
      cancelled,
      noShow,
      cancellationRate: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
      prevCancellationRate: prevTotal > 0 ? Math.round((prevCancelled / prevTotal) * 1000) / 10 : 0,
      noShowRate: total > 0 ? Math.round((noShow / total) * 1000) / 10 : 0,
      averageCheckCents: paidCount > 0 ? Math.round(revenueCents / paidCount) : 0,
      prevAverageCheckCents:
        (prevPayments._count._all ?? 0) > 0
          ? Math.round(prevRevenueCents / prevPayments._count._all)
          : 0,
    },
    byEmployee: employees
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        color: employee.color,
        position: employee.position,
        revenue: (revenueByEmployee.get(employee.id)?.revenue ?? 0) / 100,
        appointments: revenueByEmployee.get(employee.id)?.count ?? 0,
      }))
      .filter((e) => e.revenue > 0 || e.appointments > 0)
      .sort((a, b) => b.revenue - a.revenue),
    byService: Array.from(byService.entries())
      .map(([id, value]) => ({
        id,
        name: serviceMap.get(id)?.name ?? "—",
        color: serviceMap.get(id)?.color ?? "#2563EB",
        count: value.count,
        revenue: value.revenue / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    statusBreakdown: [
      { key: "COMPLETED", label: "Завершено", value: completed, color: "#059669" },
      {
        key: "CONFIRMED",
        label: "Підтверджено",
        value: statusGroups.find((g) => g.status === "CONFIRMED")?._count._all ?? 0,
        color: "#2563EB",
      },
      {
        key: "WAITING",
        label: "Очікує",
        value: statusGroups.find((g) => g.status === "WAITING")?._count._all ?? 0,
        color: "#D97706",
      },
      { key: "CANCELLED", label: "Скасовано", value: cancelled, color: "#DC2626" },
      { key: "NO_SHOW", label: "Не прийшли", value: noShow, color: "#94A3B8" },
    ].filter((s) => s.value > 0),
    employeeDirectory: employees.map((e) => ({ id: e.id, name: e.name })),
    unusedEmployeeMap: employeeMap.size,
  };
}

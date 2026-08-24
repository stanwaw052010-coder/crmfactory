import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays, endOfDay, startOfDay } from "@/lib/time";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

/**
 * Дані головного екрана. Один прохід по БД — усі запити паралельні,
 * агрегація там, де вона дешевша: у Postgres, а не в Node.
 */
export async function getDashboardData(organizationId: string, employeeFilter?: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(addDays(now, -1));
  const yesterdayEnd = endOfDay(addDays(now, -1));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = addDays(todayStart, -7);
  const twoWeeksAgo = addDays(todayStart, -14);

  const employeeWhere = employeeFilter ? { employeeId: employeeFilter } : {};

  const [
    todayAppointments,
    todayCount,
    yesterdayCount,
    cancelledToday,
    cancelledYesterday,
    newClientsWeek,
    newClientsPrevWeek,
    revenueToday,
    revenueYesterday,
    revenueMonth,
    upcoming,
    recentClients,
    topServices,
    totalClients,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        ...employeeWhere,
        startAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
        service: { select: { id: true, name: true, color: true } },
        employee: { select: { id: true, name: true, color: true, avatarUrl: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        ...employeeWhere,
        startAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        ...employeeWhere,
        startAt: { gte: yesterdayStart, lte: yesterdayEnd },
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        ...employeeWhere,
        startAt: { gte: todayStart, lte: todayEnd },
        status: { in: ["CANCELLED", "NO_SHOW"] },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        ...employeeWhere,
        startAt: { gte: yesterdayStart, lte: yesterdayEnd },
        status: { in: ["CANCELLED", "NO_SHOW"] },
      },
    }),
    prisma.client.count({ where: { organizationId, createdAt: { gte: weekAgo } } }),
    prisma.client.count({
      where: { organizationId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId,
        status: "PAID",
        paidAt: { gte: todayStart, lte: todayEnd },
        ...(employeeFilter ? { employeeId: employeeFilter } : {}),
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId,
        status: "PAID",
        paidAt: { gte: yesterdayStart, lte: yesterdayEnd },
        ...(employeeFilter ? { employeeId: employeeFilter } : {}),
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId, status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId,
        ...employeeWhere,
        startAt: { gt: todayEnd },
        status: { in: ["CONFIRMED", "WAITING"] },
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
        service: { select: { name: true, color: true } },
        employee: { select: { name: true, color: true } },
      },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, status: true, createdAt: true, phone: true },
    }),
    prisma.appointment.groupBy({
      by: ["serviceId"],
      where: {
        organizationId,
        startAt: { gte: addDays(now, -30) },
        status: { notIn: ["CANCELLED"] },
      },
      _count: { _all: true },
      _sum: { priceCents: true },
      orderBy: { _count: { serviceId: "desc" } },
      take: 5,
    }),
    prisma.client.count({ where: { organizationId } }),
  ]);

  const serviceIds = topServices.map((s) => s.serviceId);
  const services = serviceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds }, organizationId },
        select: { id: true, name: true, color: true },
      })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  return {
    todayAppointments,
    stats: {
      todayCount,
      yesterdayCount,
      cancelledToday,
      cancelledYesterday,
      newClientsWeek,
      newClientsPrevWeek,
      revenueTodayCents: revenueToday._sum.amountCents ?? 0,
      revenueYesterdayCents: revenueYesterday._sum.amountCents ?? 0,
      revenueMonthCents: revenueMonth._sum.amountCents ?? 0,
      totalClients,
    },
    upcoming,
    recentClients,
    topServices: topServices.map((row) => ({
      id: row.serviceId,
      name: serviceMap.get(row.serviceId)?.name ?? "—",
      color: serviceMap.get(row.serviceId)?.color ?? "#2563EB",
      count: row._count._all,
      revenueCents: row._sum.priceCents ?? 0,
    })),
  };
}

/** Виручка по днях за N днів — для міні-графіка на дашборді. */
export async function getRevenueSeries(organizationId: string, days = 14) {
  const from = startOfDay(addDays(new Date(), -(days - 1)));
  const payments = await prisma.payment.findMany({
    where: { organizationId, status: "PAID", paidAt: { gte: from } },
    select: { amountCents: true, paidAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    buckets.set(date.toISOString().slice(0, 10), 0);
  }
  for (const payment of payments) {
    const key = payment.paidAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + payment.amountCents);
  }

  return Array.from(buckets.entries()).map(([date, cents]) => ({
    date,
    value: cents / 100,
  }));
}

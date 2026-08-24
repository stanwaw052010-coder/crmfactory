import "server-only";
import type { ClientStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const CLIENT_PAGE_SIZE = 20;

export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  status: ClientStatus;
  tags: string[];
  createdAt: Date;
  lastVisit: Date | null;
  nextVisit: Date | null;
  visits: number;
  totalCents: number;
};

/**
 * Список клієнтів із пагінацією.
 *
 * Агрегати (візити, сума, останній/наступний візит) рахуються ОДНИМ
 * groupBy на сторінку — а не запитом на кожного клієнта. Тому таблиця
 * однаково швидка і на 50, і на 50 000 клієнтів.
 */
export async function listClients(params: {
  organizationId: string;
  query?: string;
  status?: ClientStatus | "ALL";
  page: number;
  sort?: "recent" | "name" | "spent";
}): Promise<{ rows: ClientRow[]; total: number; page: number; pageSize: number }> {
  const q = params.query?.trim();
  const where: Prisma.ClientWhereInput = {
    organizationId: params.organizationId,
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const page = Math.max(1, params.page);
  const orderBy: Prisma.ClientOrderByWithRelationInput =
    params.sort === "name" ? { firstName: "asc" } : { createdAt: "desc" };

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy,
      skip: (page - 1) * CLIENT_PAGE_SIZE,
      take: CLIENT_PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        tags: true,
        createdAt: true,
      },
    }),
  ]);

  const ids = clients.map((client) => client.id);
  if (ids.length === 0) {
    return { rows: [], total, page, pageSize: CLIENT_PAGE_SIZE };
  }

  const now = new Date();
  const [visitStats, lastVisits, nextVisits, spend] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: {
        organizationId: params.organizationId,
        clientId: { in: ids },
        status: { in: ["COMPLETED", "CONFIRMED"] },
      },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: {
        organizationId: params.organizationId,
        clientId: { in: ids },
        startAt: { lte: now },
        status: { notIn: ["CANCELLED"] },
      },
      _max: { startAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: {
        organizationId: params.organizationId,
        clientId: { in: ids },
        startAt: { gt: now },
        status: { in: ["CONFIRMED", "WAITING"] },
      },
      _min: { startAt: true },
    }),
    prisma.payment.groupBy({
      by: ["clientId"],
      where: {
        organizationId: params.organizationId,
        clientId: { in: ids },
        status: "PAID",
      },
      _sum: { amountCents: true },
    }),
  ]);

  const visitMap = new Map(visitStats.map((row) => [row.clientId, row._count._all]));
  const lastMap = new Map(lastVisits.map((row) => [row.clientId, row._max.startAt]));
  const nextMap = new Map(nextVisits.map((row) => [row.clientId, row._min.startAt]));
  const spendMap = new Map(spend.map((row) => [row.clientId, row._sum.amountCents ?? 0]));

  const rows: ClientRow[] = clients.map((client) => ({
    ...client,
    visits: visitMap.get(client.id) ?? 0,
    lastVisit: lastMap.get(client.id) ?? null,
    nextVisit: nextMap.get(client.id) ?? null,
    totalCents: spendMap.get(client.id) ?? 0,
  }));

  if (params.sort === "spent") rows.sort((a, b) => b.totalCents - a.totalCents);

  return { rows, total, page, pageSize: CLIENT_PAGE_SIZE };
}

export async function getClientProfile(organizationId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      notes: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!client) return null;

  const now = new Date();
  const [appointments, payments, stats, nextVisit] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId, clientId },
      include: {
        service: { select: { name: true, color: true } },
        employee: { select: { name: true, color: true } },
      },
      orderBy: { startAt: "desc" },
      take: 50,
    }),
    prisma.payment.findMany({
      where: { organizationId, clientId },
      include: { employee: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
    prisma.payment.aggregate({
      where: { organizationId, clientId, status: "PAID" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.appointment.findFirst({
      where: {
        organizationId,
        clientId,
        startAt: { gt: now },
        status: { in: ["CONFIRMED", "WAITING"] },
      },
      include: { service: { select: { name: true } }, employee: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const totalCents = stats._sum.amountCents ?? 0;
  const paidCount = stats._count._all;

  return {
    client,
    appointments,
    payments,
    nextVisit,
    stats: {
      visits: completed,
      totalCents,
      averageCents: paidCount > 0 ? Math.round(totalCents / paidCount) : 0,
      cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      noShow: appointments.filter((a) => a.status === "NO_SHOW").length,
    },
  };
}

import "server-only";
import { prisma } from "@/lib/db/prisma";

export type SearchResult = {
  type: "client" | "appointment" | "employee" | "service";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
};

/**
 * Глобальний пошук (⌘K). Свідомо обмежений — по кілька записів
 * кожного типу, щоб відповідь була миттєвою навіть на великій базі.
 */
export async function globalSearch(
  organizationId: string,
  query: string,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [clients, employees, services, appointments] = await Promise.all([
    prisma.client.findMany({
      where: {
        organizationId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, status: true },
      take: 5,
    }),
    prisma.employee.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { position: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, position: true },
      take: 4,
    }),
    prisma.service.findMany({
      where: { organizationId, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, durationMin: true, priceCents: true },
      take: 4,
    }),
    prisma.appointment.findMany({
      where: {
        organizationId,
        OR: [
          { client: { firstName: { contains: q, mode: "insensitive" } } },
          { client: { lastName: { contains: q, mode: "insensitive" } } },
          { client: { phone: { contains: q } } },
        ],
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
      orderBy: { startAt: "desc" },
      take: 4,
    }),
  ]);

  const results: SearchResult[] = [];

  for (const client of clients) {
    results.push({
      type: "client",
      id: client.id,
      title: [client.firstName, client.lastName].filter(Boolean).join(" "),
      subtitle: client.phone ?? undefined,
      href: `/clients/${client.id}`,
      meta: client.status,
    });
  }
  for (const appointment of appointments) {
    results.push({
      type: "appointment",
      id: appointment.id,
      title: `${appointment.client.firstName} ${appointment.client.lastName ?? ""}`.trim(),
      subtitle: `${appointment.service.name} · ${appointment.startAt.toLocaleDateString("uk-UA")}`,
      href: `/calendar?appointment=${appointment.id}`,
    });
  }
  for (const employee of employees) {
    results.push({
      type: "employee",
      id: employee.id,
      title: employee.name,
      subtitle: employee.position ?? undefined,
      href: `/employees/${employee.id}`,
    });
  }
  for (const service of services) {
    results.push({
      type: "service",
      id: service.id,
      title: service.name,
      subtitle: `${service.durationMin} хв`,
      href: `/services?service=${service.id}`,
    });
  }

  return results;
}

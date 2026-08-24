import type { Metadata } from "next";
import { requireAuth, ownEmployeeFilter } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { CalendarView } from "@/features/calendar/calendar-view";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  fromDateKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "@/lib/time";

export const metadata: Metadata = { title: "Записи" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ctx = await requireAuth();

  const view = (["day", "week", "month"].includes(String(params.view)) ? params.view : "week") as
    | "day"
    | "week"
    | "month";
  const dateKey = typeof params.date === "string" ? params.date : toDateKey(new Date());
  const anchor = fromDateKey(dateKey);

  // Діапазон завантаження — трохи ширший за видимий, щоб перетягування
  // на сусідній день не потребувало довантаження.
  const rangeStart =
    view === "day"
      ? startOfDay(anchor)
      : view === "week"
        ? startOfWeek(anchor)
        : startOfWeek(startOfMonth(anchor));
  const rangeEnd =
    view === "day"
      ? endOfDay(anchor)
      : view === "week"
        ? endOfWeek(anchor)
        : endOfWeek(addDays(endOfMonth(anchor), 1));

  const restrictEmployee = ownEmployeeFilter(ctx);
  const employeeFilter =
    restrictEmployee ?? (typeof params.employee === "string" && params.employee !== "all"
      ? params.employee
      : undefined);
  const serviceFilter =
    typeof params.service === "string" && params.service !== "all" ? params.service : undefined;
  const statusFilter =
    typeof params.status === "string" && params.status !== "all" ? params.status : undefined;

  const [appointments, employees, services, clients, businessHours] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: ctx.organization.id,
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
        ...(employeeFilter ? { employeeId: employeeFilter } : {}),
        ...(serviceFilter ? { serviceId: serviceFilter } : {}),
        ...(statusFilter
          ? { status: statusFilter as "WAITING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" }
          : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        service: { select: { id: true, name: true, color: true, durationMin: true } },
        employee: { select: { id: true, name: true, color: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.employee.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true, color: true, position: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: {
        id: true,
        name: true,
        color: true,
        durationMin: true,
        priceCents: true,
        employees: { select: { employeeId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId: ctx.organization.id },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.businessHours.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { weekday: "asc" },
    }),
  ]);

  const dayStart = Math.min(...businessHours.filter((h) => !h.isClosed).map((h) => h.openMinute), 540);
  const dayEnd = Math.max(...businessHours.filter((h) => !h.isClosed).map((h) => h.closeMinute), 1080);

  return (
    <CalendarView
      view={view}
      dateKey={dateKey}
      currency={ctx.organization.currency}
      canEdit={ctx.permissions.has("appointment.update")}
      canCreate={ctx.permissions.has("appointment.create")}
      canDelete={ctx.permissions.has("appointment.delete")}
      lockedEmployeeId={restrictEmployee ?? null}
      filters={{
        employee: typeof params.employee === "string" ? params.employee : "all",
        service: typeof params.service === "string" ? params.service : "all",
        status: typeof params.status === "string" ? params.status : "all",
      }}
      openNew={params.new === "1"}
      openAppointmentId={typeof params.appointment === "string" ? params.appointment : null}
      dayBounds={{ start: Math.max(0, dayStart - 60), end: Math.min(1440, dayEnd + 60) }}
      appointments={appointments.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        status: a.status,
        priceCents: a.priceCents,
        note: a.note,
        source: a.source,
        client: a.client,
        service: a.service,
        employee: a.employee,
      }))}
      employees={employees}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        employeeIds: s.employees.map((e) => e.employeeId),
      }))}
      clients={clients}
    />
  );
}

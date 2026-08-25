import "server-only";
import { prisma } from "@/lib/db/prisma";
import { endOfDay, minutesOfDay, startOfDay } from "@/lib/time";

export type BriefingGap = { employeeName: string; startMinute: number; endMinute: number };

/** Вікно, коротше за це, не варто згадувати: у нього нічого не вміститься. */
const MIN_GAP_MINUTES = 60;

/**
 * Ранкове зведення.
 *
 * Найцінніша частина — не цифри, а вільні вікна: години, за які салон
 * уже платить (майстер на місці), але не заробляє. Рахуємо їх чесно —
 * по кожному майстру окремо, від його графіка на сьогодні, з відніманням
 * реальних записів і відпусток.
 */
export async function getDailyBriefing(organizationId: string, employeeFilter?: string) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekday = now.getDay();

  const employeeWhere = employeeFilter ? { employeeId: employeeFilter } : {};

  const [appointments, newClients, cancelled, employees, exceptions] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        ...employeeWhere,
        status: { in: ["CONFIRMED", "WAITING", "COMPLETED"] },
        startAt: { gte: dayStart, lte: dayEnd },
      },
      select: { employeeId: true, startAt: true, endAt: true, priceCents: true },
    }),
    prisma.client.count({
      where: { organizationId, createdAt: { gte: dayStart, lte: dayEnd } },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        ...employeeWhere,
        status: { in: ["CANCELLED", "NO_SHOW"] },
        startAt: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.employee.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(employeeFilter ? { id: employeeFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        schedules: { where: { weekday } },
      },
    }),
    prisma.scheduleException.findMany({
      where: { employee: { organizationId }, date: { lte: dayEnd } },
      select: { employeeId: true, date: true, endDate: true },
    }),
  ]);

  const expectedCents = appointments.reduce((sum, item) => sum + item.priceCents, 0);
  const nowMinute = minutesOfDay(now);

  const busyByEmployee = new Map<string, { start: number; end: number }[]>();
  for (const appointment of appointments) {
    const list = busyByEmployee.get(appointment.employeeId) ?? [];
    list.push({
      start: minutesOfDay(appointment.startAt),
      end: minutesOfDay(appointment.endAt),
    });
    busyByEmployee.set(appointment.employeeId, list);
  }

  const gaps: BriefingGap[] = [];

  for (const employee of employees) {
    const schedule = employee.schedules[0];
    if (!schedule || schedule.isDayOff) continue;

    const away = exceptions.some((exception) => {
      if (exception.employeeId !== employee.id) return false;
      const start = startOfDay(exception.date).getTime();
      const end = startOfDay(exception.endDate ?? exception.date).getTime();
      return dayStart.getTime() >= start && dayStart.getTime() <= end;
    });
    if (away) continue;

    const busy = (busyByEmployee.get(employee.id) ?? []).sort((a, b) => a.start - b.start);

    // Вікна шукаємо лише попереду: години, що вже минули, закрити нічим.
    let cursor = Math.max(schedule.startMinute, nowMinute);

    for (const slot of busy) {
      if (slot.start - cursor >= MIN_GAP_MINUTES) {
        gaps.push({ employeeName: employee.name, startMinute: cursor, endMinute: slot.start });
      }
      cursor = Math.max(cursor, slot.end);
    }

    if (schedule.endMinute - cursor >= MIN_GAP_MINUTES) {
      gaps.push({
        employeeName: employee.name,
        startMinute: cursor,
        endMinute: schedule.endMinute,
      });
    }
  }

  gaps.sort((a, b) => a.startMinute - b.startMinute);

  return {
    appointments: appointments.length,
    expectedCents,
    newClients,
    cancelled,
    gaps,
    generatedAt: now.getTime(),
  };
}

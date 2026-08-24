import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addMinutes, minutesToTime, startOfDay, endOfDay, toDateKey } from "@/lib/time";

/**
 * Рушій доступності.
 *
 * Одна функція відповідає і за публічну сторінку онлайн-запису,
 * і за перевірку конфліктів усередині CRM. Логіка одна — отже,
 * неможлива ситуація «онлайн дозволив те, що CRM вважає зайнятим».
 *
 * Враховує: графік співробітника, перерви, винятки (відпустки/вихідні),
 * робочі години бізнесу, вже наявні записи та buffer між послугами.
 */

export type Slot = { time: string; startAt: Date };

type Interval = { start: number; end: number };

function subtract(base: Interval[], cut: Interval): Interval[] {
  const result: Interval[] = [];
  for (const interval of base) {
    if (cut.end <= interval.start || cut.start >= interval.end) {
      result.push(interval);
      continue;
    }
    if (cut.start > interval.start) result.push({ start: interval.start, end: cut.start });
    if (cut.end < interval.end) result.push({ start: cut.end, end: interval.end });
  }
  return result.filter((i) => i.end > i.start);
}

export type AvailabilityOptions = {
  organizationId: string;
  employeeId: string;
  date: Date;
  durationMin: number;
  stepMin?: number;
  leadTimeMin?: number;
  /** Запис, який редагується — його час не рахується як зайнятий. */
  ignoreAppointmentId?: string;
  /** Публічне бронювання поважає робочі години бізнесу; CRM — ні. */
  respectBusinessHours?: boolean;
};

/** Вільні інтервали співробітника на дату, у хвилинах від опівночі. */
export async function freeIntervals(options: AvailabilityOptions): Promise<Interval[]> {
  const { organizationId, employeeId, date } = options;
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const weekday = dayStart.getDay();

  const [schedule, exceptions, businessHours, appointments] = await Promise.all([
    prisma.employeeSchedule.findUnique({
      where: { employeeId_weekday: { employeeId, weekday } },
    }),
    prisma.scheduleException.findMany({
      where: {
        employeeId,
        OR: [
          { date: { lte: dayStart }, endDate: { gte: dayStart } },
          { date: { gte: dayStart, lte: dayEnd }, endDate: null },
        ],
      },
    }),
    options.respectBusinessHours
      ? prisma.businessHours.findUnique({
          where: { organizationId_weekday: { organizationId, weekday } },
        })
      : Promise.resolve(null),
    prisma.appointment.findMany({
      where: {
        organizationId,
        employeeId,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(options.ignoreAppointmentId ? { id: { not: options.ignoreAppointmentId } } : {}),
      },
      include: { service: { select: { bufferMin: true } } },
    }),
  ]);

  if (!schedule || schedule.isDayOff) return [];
  if (options.respectBusinessHours && businessHours?.isClosed) return [];

  let windows: Interval[] = [{ start: schedule.startMinute, end: schedule.endMinute }];

  if (options.respectBusinessHours && businessHours) {
    windows = windows
      .map((w) => ({
        start: Math.max(w.start, businessHours.openMinute),
        end: Math.min(w.end, businessHours.closeMinute),
      }))
      .filter((w) => w.end > w.start);
  }

  if (schedule.breakStart != null && schedule.breakEnd != null) {
    windows = subtract(windows, { start: schedule.breakStart, end: schedule.breakEnd });
  }

  for (const exception of exceptions) {
    if (exception.type === "CUSTOM_HOURS") {
      if (exception.startMinute != null && exception.endMinute != null) {
        windows = windows
          .map((w) => ({
            start: Math.max(w.start, exception.startMinute!),
            end: Math.min(w.end, exception.endMinute!),
          }))
          .filter((w) => w.end > w.start);
      }
    } else {
      return [];
    }
  }

  for (const appointment of appointments) {
    const start = Math.floor(
      (appointment.startAt.getTime() - dayStart.getTime()) / 60000,
    );
    const end = Math.ceil(
      (appointment.endAt.getTime() - dayStart.getTime()) / 60000,
    ) + (appointment.service?.bufferMin ?? 0);
    windows = subtract(windows, { start, end });
  }

  return windows;
}

/** Готові слоти для показу клієнту. */
export async function availableSlots(options: AvailabilityOptions): Promise<Slot[]> {
  const step = options.stepMin ?? 15;
  const duration = options.durationMin;
  const windows = await freeIntervals(options);
  const dayStart = startOfDay(options.date);
  const earliest = Date.now() + (options.leadTimeMin ?? 0) * 60_000;

  const slots: Slot[] = [];
  for (const window of windows) {
    const first = Math.ceil(window.start / step) * step;
    for (let minute = first; minute + duration <= window.end; minute += step) {
      const startAt = addMinutes(dayStart, minute);
      if (startAt.getTime() < earliest) continue;
      slots.push({ time: minutesToTime(minute), startAt });
    }
  }
  return slots;
}

/** Чи вільний конкретний проміжок (перевірка перед створенням запису). */
export async function isSlotFree(
  options: AvailabilityOptions & { startMinute: number },
): Promise<boolean> {
  const windows = await freeIntervals(options);
  const end = options.startMinute + options.durationMin;
  return windows.some((w) => w.start <= options.startMinute && w.end >= end);
}

/** Дні з хоча б одним вільним слотом — для календаря публічного бронювання. */
export async function daysWithAvailability(params: {
  organizationId: string;
  employeeId: string;
  from: Date;
  days: number;
  durationMin: number;
  stepMin: number;
  leadTimeMin: number;
}): Promise<Set<string>> {
  const available = new Set<string>();
  for (let i = 0; i < params.days; i++) {
    const date = new Date(params.from);
    date.setDate(date.getDate() + i);
    const slots = await availableSlots({
      organizationId: params.organizationId,
      employeeId: params.employeeId,
      date,
      durationMin: params.durationMin,
      stepMin: params.stepMin,
      leadTimeMin: params.leadTimeMin,
      respectBusinessHours: true,
    });
    if (slots.length > 0) available.add(toDateKey(date));
  }
  return available;
}

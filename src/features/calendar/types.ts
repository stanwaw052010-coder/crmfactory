import type { AppointmentStatus } from "@prisma/client";

export type CalendarAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  priceCents: number;
  note: string | null;
  source: string;
  client: { id: string; firstName: string; lastName: string | null; phone: string | null };
  service: { id: string; name: string; color: string; durationMin: number };
  employee: { id: string; name: string; color: string };
};

export type CalendarEmployee = {
  id: string;
  name: string;
  color: string;
  position: string | null;
  avatarUrl: string | null;
};

export type CalendarService = {
  id: string;
  name: string;
  color: string;
  durationMin: number;
  priceCents: number;
  employeeIds: string[];
};

export type CalendarClient = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
};

export type DayBounds = { start: number; end: number };

/** Розкладка подій, що перетинаються: колонки всередині одного дня. */
export type LaidOutAppointment = CalendarAppointment & {
  column: number;
  columns: number;
  startMinute: number;
  endMinute: number;
};

export function layoutDay(appointments: CalendarAppointment[]): LaidOutAppointment[] {
  const events = appointments
    .map((appointment) => {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);
      return {
        ...appointment,
        startMinute: start.getHours() * 60 + start.getMinutes(),
        endMinute: end.getHours() * 60 + end.getMinutes(),
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const result: LaidOutAppointment[] = [];
  let cluster: (typeof events)[number][] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns: (typeof events)[number][][] = [];
    for (const event of cluster) {
      let placed = false;
      for (const column of columns) {
        if (column[column.length - 1].endMinute <= event.startMinute) {
          column.push(event);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([event]);
    }
    columns.forEach((column, columnIndex) => {
      for (const event of column) {
        result.push({ ...event, column: columnIndex, columns: columns.length });
      }
    });
    cluster = [];
    clusterEnd = -1;
  };

  for (const event of events) {
    if (cluster.length > 0 && event.startMinute >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.endMinute);
  }
  flush();

  return result;
}

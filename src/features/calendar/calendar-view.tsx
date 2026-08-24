"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarPlus, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { CalendarToolbar } from "@/features/calendar/calendar-toolbar";
import { TimeGrid, weekColumns } from "@/features/calendar/time-grid";
import { MonthGrid, monthDays } from "@/features/calendar/month-grid";
import { AppointmentModal } from "@/features/calendar/appointment-modal";
import { AppointmentDetails } from "@/features/calendar/appointment-details";
import { moveAppointmentAction } from "@/server/actions/appointments";
import {
  addDays,
  fromDateKey,
  minutesToTime,
  startOfWeek,
  toDateKey,
} from "@/lib/time";
import type {
  CalendarAppointment,
  CalendarClient,
  CalendarEmployee,
  CalendarService,
  DayBounds,
} from "@/features/calendar/types";

export function CalendarView(props: {
  view: "day" | "week" | "month";
  dateKey: string;
  currency: string;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  lockedEmployeeId: string | null;
  filters: { employee: string; service: string; status: string };
  openNew: boolean;
  openAppointmentId: string | null;
  dayBounds: DayBounds;
  appointments: CalendarAppointment[];
  employees: CalendarEmployee[];
  services: CalendarService[];
  clients: CalendarClient[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const anchor = React.useMemo(() => fromDateKey(props.dateKey), [props.dateKey]);

  const [editing, setEditing] = React.useState<CalendarAppointment | null>(null);
  const [detailsId, setDetailsId] = React.useState<string | null>(props.openAppointmentId);
  const [modalOpen, setModalOpen] = React.useState(props.openNew);
  const [defaults, setDefaults] = React.useState({
    date: props.dateKey,
    time: "10:00",
    employeeId: undefined as string | undefined,
  });
  // Оптимістичні позиції під час drag & drop: UI не чекає на сервер.
  const [optimistic, setOptimistic] = React.useState<
    Record<string, { startAt: string; endAt: string; employeeId?: string }>
  >({});

  const setParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  React.useEffect(() => {
    setDetailsId(props.openAppointmentId);
  }, [props.openAppointmentId]);

  React.useEffect(() => {
    if (props.openNew) {
      setEditing(null);
      setModalOpen(true);
    }
  }, [props.openNew]);

  React.useEffect(() => {
    setOptimistic({});
  }, [props.appointments]);

  const appointments = React.useMemo(
    () =>
      props.appointments.map((appointment) => {
        const patch = optimistic[appointment.id];
        if (!patch) return appointment;
        const employee =
          patch.employeeId && patch.employeeId !== appointment.employee.id
            ? props.employees.find((e) => e.id === patch.employeeId)
            : undefined;
        return {
          ...appointment,
          startAt: patch.startAt,
          endAt: patch.endAt,
          ...(employee
            ? { employee: { id: employee.id, name: employee.name, color: employee.color } }
            : {}),
        };
      }),
    [props.appointments, optimistic, props.employees],
  );

  const detailsAppointment = detailsId
    ? (appointments.find((a) => a.id === detailsId) ?? null)
    : null;

  const days = React.useMemo(() => {
    if (props.view === "day") return [anchor];
    if (props.view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return monthDays(anchor);
  }, [props.view, anchor]);

  const navigate = (direction: -1 | 1) => {
    const next = new Date(anchor);
    if (props.view === "day") next.setDate(next.getDate() + direction);
    else if (props.view === "week") next.setDate(next.getDate() + 7 * direction);
    else next.setMonth(next.getMonth() + direction);
    setParams({ date: toDateKey(next) });
  };

  const openCreate = (date: Date, minute?: number, employeeId?: string) => {
    setEditing(null);
    setDefaults({
      date: toDateKey(date),
      time: minute != null ? minutesToTime(minute) : "10:00",
      employeeId,
    });
    setModalOpen(true);
  };

  const commitMove = async (
    id: string,
    startAt: Date,
    durationMin: number,
    employeeId?: string,
  ) => {
    const endAt = new Date(startAt.getTime() + durationMin * 60_000);
    setOptimistic((prev) => ({
      ...prev,
      [id]: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), employeeId },
    }));

    const result = await moveAppointmentAction({
      id,
      startAt: startAt.toISOString(),
      durationMin,
      employeeId,
    });

    if (result.ok) {
      toast.success("Запис перенесено");
      router.refresh();
    } else {
      // Помилка — відкочуємо оптимістичну зміну.
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error("Не вдалося перенести", result.error);
    }
  };

  const moveToDate = (id: string, date: Date) => {
    const appointment = appointments.find((a) => a.id === id);
    if (!appointment) return;
    const start = new Date(appointment.startAt);
    const end = new Date(appointment.endAt);
    const duration = Math.round((end.getTime() - start.getTime()) / 60_000);
    const target = new Date(date);
    target.setHours(start.getHours(), start.getMinutes(), 0, 0);
    void commitMove(id, target, duration);
  };

  const dayColumns = React.useMemo(() => {
    if (props.view !== "day") return [];
    const visible = props.lockedEmployeeId
      ? props.employees.filter((e) => e.id === props.lockedEmployeeId)
      : props.filters.employee !== "all"
        ? props.employees.filter((e) => e.id === props.filters.employee)
        : props.employees;

    if (visible.length === 0) {
      return [{ key: toDateKey(anchor), date: anchor, label: "Розклад", sublabel: "" }];
    }
    return visible.map((employee) => ({
      key: `${toDateKey(anchor)}-${employee.id}`,
      date: anchor,
      employeeId: employee.id,
      label: employee.name,
      color: employee.color,
    }));
  }, [props.view, props.employees, props.filters.employee, props.lockedEmployeeId, anchor]);

  const noEmployees = props.employees.length === 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <CalendarToolbar
        view={props.view}
        anchor={anchor}
        filters={props.filters}
        employees={props.employees}
        services={props.services}
        lockedEmployeeId={props.lockedEmployeeId}
        onViewChange={(view) => setParams({ view })}
        onNavigate={navigate}
        onToday={() => setParams({ date: toDateKey(new Date()) })}
        onFilterChange={(key, value) => setParams({ [key]: value === "all" ? null : value })}
      />

      {noEmployees ? (
        <div className="card">
          <EmptyState
            icon={CalendarRange}
            title="Спочатку додайте команду"
            description="Календар будується навколо співробітників: у кожного свій графік і свої записи. Додайте хоча б одного — і можна приймати клієнтів."
            action={
              <Button onClick={() => router.push("/employees?new=1")}>Додати співробітника</Button>
            }
          />
        </div>
      ) : props.view === "month" ? (
        <MonthGrid
          days={days}
          anchor={anchor}
          appointments={appointments}
          canEdit={props.canEdit}
          canCreate={props.canCreate}
          onOpen={(appointment) => setDetailsId(appointment.id)}
          onCreate={(date) => openCreate(date)}
          onMoveToDate={moveToDate}
          onSelectDay={(date) => setParams({ date: toDateKey(date), view: "day" })}
        />
      ) : (
        <TimeGrid
          columns={props.view === "day" ? dayColumns : weekColumns(days)}
          appointments={appointments}
          bounds={props.dayBounds}
          currency={props.currency}
          canEdit={props.canEdit}
          canCreate={props.canCreate}
          pxPerMinute={props.view === "day" ? 1.3 : 1}
          onOpen={(appointment) => setDetailsId(appointment.id)}
          onCreate={openCreate}
          onMove={commitMove}
        />
      )}

      {appointments.length === 0 && !noEmployees && props.view !== "month" && (
        <div className="card mt-4">
          <EmptyState
            compact
            icon={CalendarPlus}
            title="На цей період записів немає"
            description="Клікніть на вільний час у сітці або створіть запис вручну."
            action={
              props.canCreate ? (
                <Button size="sm" onClick={() => openCreate(anchor, 600)}>
                  <CalendarPlus className="h-4 w-4" />
                  Створити запис
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          if (searchParams.get("new")) setParams({ new: null });
        }}
        onSaved={() => router.refresh()}
        appointment={editing}
        defaults={defaults}
        clients={props.clients}
        services={props.services}
        employees={props.employees}
        currency={props.currency}
        lockedEmployeeId={props.lockedEmployeeId}
      />

      <AppointmentDetails
        appointment={detailsAppointment}
        open={Boolean(detailsAppointment)}
        onClose={() => {
          setDetailsId(null);
          if (searchParams.get("appointment")) setParams({ appointment: null });
        }}
        onEdit={() => {
          setEditing(detailsAppointment);
          setDetailsId(null);
          setModalOpen(true);
        }}
        onChanged={() => router.refresh()}
        currency={props.currency}
        canEdit={props.canEdit}
        canDelete={props.canDelete}
      />
    </div>
  );
}

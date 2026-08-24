"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import {
  isToday,
  minutesToTime,
  toDateKey,
  WEEKDAYS_SHORT_UK,
} from "@/lib/time";
import { layoutDay, type CalendarAppointment, type DayBounds } from "@/features/calendar/types";

const SNAP_MINUTES = 15;

type Column = {
  key: string;
  date: Date;
  /** Для day-view з розбивкою по співробітниках. */
  employeeId?: string;
  label: string;
  sublabel?: string;
  color?: string;
};

type DragState = {
  id: string;
  mode: "move" | "resize";
  startClientY: number;
  startClientX: number;
  originStartMinute: number;
  originDuration: number;
  originColumn: number;
  deltaMinutes: number;
  targetColumn: number;
  moved: boolean;
};

/**
 * Сітка дня/тижня з перетягуванням.
 *
 * Перетягування зроблено на pointer-подіях, а не HTML5 drag-and-drop:
 * так воно однаково працює на тачі, дає точне прилипання до 15 хвилин
 * і не потребує «привида» елемента.
 */
export function TimeGrid({
  columns,
  appointments,
  bounds,
  currency,
  canEdit,
  canCreate,
  pxPerMinute = 1,
  onOpen,
  onCreate,
  onMove,
}: {
  columns: Column[];
  appointments: CalendarAppointment[];
  bounds: DayBounds;
  currency: string;
  canEdit: boolean;
  canCreate: boolean;
  pxPerMinute?: number;
  onOpen: (appointment: CalendarAppointment) => void;
  onCreate: (date: Date, minute: number, employeeId?: string) => void;
  onMove: (id: string, startAt: Date, durationMin: number, employeeId?: string) => void;
}) {
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [now, setNow] = React.useState(() => new Date());

  const totalMinutes = bounds.end - bounds.start;
  const height = totalMinutes * pxPerMinute;

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Прокручуємо до початку робочого дня, а не до опівночі.
  React.useEffect(() => {
    if (!scrollRef.current) return;
    const target = Math.max(0, (9 * 60 - bounds.start) * pxPerMinute - 40);
    scrollRef.current.scrollTop = target;
  }, [bounds.start, pxPerMinute]);

  const byColumn = React.useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const column of columns) map.set(column.key, []);
    for (const appointment of appointments) {
      const start = new Date(appointment.startAt);
      const dateKey = toDateKey(start);
      const key = columns.find(
        (column) =>
          toDateKey(column.date) === dateKey &&
          (!column.employeeId || column.employeeId === appointment.employee.id),
      )?.key;
      if (key) map.get(key)!.push(appointment);
    }
    return map;
  }, [columns, appointments]);

  const columnWidth = React.useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return 0;
    return grid.clientWidth / columns.length;
  }, [columns.length]);

  const startDrag = (
    event: React.PointerEvent,
    appointment: CalendarAppointment,
    mode: "move" | "resize",
    columnIndex: number,
  ) => {
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    const start = new Date(appointment.startAt);
    const end = new Date(appointment.endAt);
    setDrag({
      id: appointment.id,
      mode,
      startClientY: event.clientY,
      startClientX: event.clientX,
      originStartMinute: start.getHours() * 60 + start.getMinutes(),
      originDuration: Math.round((end.getTime() - start.getTime()) / 60_000),
      originColumn: columnIndex,
      deltaMinutes: 0,
      targetColumn: columnIndex,
      moved: false,
    });
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  React.useEffect(() => {
    if (!drag) return;

    const onMoveEvent = (event: PointerEvent) => {
      const deltaY = event.clientY - drag.startClientY;
      const rawMinutes = deltaY / pxPerMinute;
      const deltaMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;

      let targetColumn = drag.originColumn;
      if (drag.mode === "move" && columns.length > 1) {
        const width = columnWidth();
        if (width > 0) {
          const deltaX = event.clientX - drag.startClientX;
          targetColumn = Math.min(
            columns.length - 1,
            Math.max(0, drag.originColumn + Math.round(deltaX / width)),
          );
        }
      }

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              deltaMinutes,
              targetColumn,
              moved: prev.moved || Math.abs(deltaY) > 3 || targetColumn !== prev.originColumn,
            }
          : prev,
      );
    };

    const onUp = () => {
      setDrag((prev) => {
        if (!prev) return null;
        if (!prev.moved || prev.deltaMinutes === 0) {
          if (prev.targetColumn === prev.originColumn) return null;
        }

        const appointment = appointments.find((a) => a.id === prev.id);
        if (!appointment) return null;

        const column = columns[prev.targetColumn];
        if (prev.mode === "move") {
          const minute = clampMinute(prev.originStartMinute + prev.deltaMinutes, prev.originDuration);
          const startAt = new Date(column.date);
          startAt.setHours(0, minute, 0, 0);
          onMove(prev.id, startAt, prev.originDuration, column.employeeId);
        } else {
          const duration = Math.max(
            SNAP_MINUTES,
            Math.min(600, prev.originDuration + prev.deltaMinutes),
          );
          const startAt = new Date(appointment.startAt);
          onMove(prev.id, startAt, duration);
        }
        return null;
      });
    };

    const clampMinute = (minute: number, duration: number) =>
      Math.max(bounds.start, Math.min(minute, bounds.end - duration));

    window.addEventListener("pointermove", onMoveEvent);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMoveEvent);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, appointments, columns, pxPerMinute, bounds, onMove, columnWidth]);

  const handleGridClick = (event: React.MouseEvent, column: Column) => {
    if (!canCreate || drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const minute =
      Math.floor((offsetY / pxPerMinute + bounds.start) / SNAP_MINUTES) * SNAP_MINUTES;
    onCreate(column.date, Math.max(bounds.start, Math.min(minute, bounds.end - 30)), column.employeeId);
  };

  const hours: number[] = [];
  for (let m = Math.ceil(bounds.start / 60) * 60; m <= bounds.end; m += 60) hours.push(m);

  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMinute >= bounds.start && nowMinute <= bounds.end;

  return (
    <div className="card overflow-hidden">
      {/* Заголовки колонок */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="w-14 shrink-0 sm:w-16" />
        {columns.map((column) => {
          const today = isToday(column.date);
          return (
            <div
              key={column.key}
              className="min-w-0 flex-1 border-l border-[var(--border)] px-2 py-2.5 text-center"
            >
              {column.employeeId ? (
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: column.color }}
                    aria-hidden
                  />
                  <span className="truncate text-[12.5px] font-medium text-[var(--fg)]">
                    {column.label}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-medium text-[var(--fg-subtle)] uppercase">
                    {column.label}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold tabular-nums",
                      today ? "bg-[var(--primary)] text-white" : "text-[var(--fg)]",
                    )}
                  >
                    {column.sublabel}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Сітка */}
      <div ref={scrollRef} className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <div className="flex" style={{ height }}>
          {/* Гутер годин */}
          <div className="relative w-14 shrink-0 sm:w-16">
            {hours.map((minute) => (
              <div
                key={minute}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-[var(--fg-subtle)] tabular-nums"
                style={{ top: (minute - bounds.start) * pxPerMinute }}
              >
                {minutesToTime(minute)}
              </div>
            ))}
          </div>

          <div ref={gridRef} className="relative flex min-w-0 flex-1">
            {/* Горизонтальні лінії */}
            {hours.map((minute) => (
              <div
                key={minute}
                className="pointer-events-none absolute inset-x-0 border-t border-[var(--border)]"
                style={{ top: (minute - bounds.start) * pxPerMinute }}
              />
            ))}

            {showNow && columns.some((c) => isToday(c.date)) && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                style={{ top: (nowMinute - bounds.start) * pxPerMinute }}
              >
                <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                <span className="h-px flex-1 bg-[var(--danger)]" />
              </div>
            )}

            {columns.map((column, columnIndex) => {
              const items = layoutDay(byColumn.get(column.key) ?? []);
              return (
                <div
                  key={column.key}
                  onClick={(event) => handleGridClick(event, column)}
                  className={cn(
                    "relative min-w-0 flex-1 border-l border-[var(--border)]",
                    canCreate && "cursor-copy",
                    isToday(column.date) && "bg-[var(--primary)]/[0.02]",
                  )}
                >
                  {items.map((item) => {
                    const isDragging = drag?.id === item.id;
                    const offset = isDragging && drag.mode === "move" ? drag.deltaMinutes : 0;
                    const extra = isDragging && drag.mode === "resize" ? drag.deltaMinutes : 0;
                    const duration = Math.max(SNAP_MINUTES, item.endMinute - item.startMinute + extra);
                    const top = (item.startMinute + offset - bounds.start) * pxPerMinute;
                    const blockHeight = Math.max(duration * pxPerMinute, 22);
                    const widthPercent = 100 / item.columns;
                    const cancelled = item.status === "CANCELLED" || item.status === "NO_SHOW";
                    const columnShift =
                      isDragging && drag.mode === "move"
                        ? (drag.targetColumn - columnIndex) * 100
                        : 0;

                    return (
                      <div
                        key={item.id}
                        onPointerDown={(event) => startDrag(event, item, "move", columnIndex)}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!drag?.moved) onOpen(item);
                        }}
                        className={cn(
                          "group absolute z-10 overflow-hidden rounded-[10px] border-l-[3px] px-2 py-1 select-none",
                          "transition-shadow duration-150 hover:z-20 hover:shadow-[var(--shadow-lift)]",
                          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                          isDragging && "z-30 opacity-90 shadow-[var(--shadow-pop)]",
                          cancelled && "opacity-55",
                        )}
                        style={{
                          top,
                          height: blockHeight,
                          left: `calc(${item.column * widthPercent}% + ${columnShift}%)`,
                          width: `calc(${widthPercent}% - 3px)`,
                          background: `color-mix(in oklab, ${item.service.color} 14%, var(--surface))`,
                          borderLeftColor: item.service.color,
                        }}
                        title={`${item.client.firstName} · ${item.service.name}`}
                      >
                        <p className="truncate text-[11.5px] leading-tight font-semibold text-[var(--fg)]">
                          {minutesToTime(item.startMinute + offset)}{" "}
                          {item.client.firstName} {item.client.lastName ?? ""}
                        </p>
                        {blockHeight > 34 && (
                          <p className="truncate text-[11px] leading-tight text-[var(--fg-muted)]">
                            {item.service.name}
                          </p>
                        )}
                        {blockHeight > 52 && (
                          <p className="mt-0.5 truncate text-[11px] leading-tight font-medium text-[var(--fg-muted)]">
                            {formatMoney(item.priceCents, currency)}
                            {!column.employeeId && ` · ${item.employee.name}`}
                          </p>
                        )}
                        {cancelled && (
                          <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,color-mix(in_oklab,var(--fg-subtle)_22%,transparent)_5px,color-mix(in_oklab,var(--fg-subtle)_22%,transparent)_10px)]" />
                        )}

                        {canEdit && (
                          <span
                            onPointerDown={(event) => startDrag(event, item, "resize", columnIndex)}
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <span className="mx-auto block h-0.5 w-6 rounded-full bg-[var(--fg-subtle)]" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function weekColumns(days: Date[]): Column[] {
  return days.map((date) => ({
    key: toDateKey(date),
    date,
    label: WEEKDAYS_SHORT_UK[date.getDay()],
    sublabel: String(date.getDate()),
  }));
}

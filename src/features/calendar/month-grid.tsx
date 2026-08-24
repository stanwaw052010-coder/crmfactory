"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatTime, isToday, toDateKey, WEEKDAYS_SHORT_UK } from "@/lib/time";
import type { CalendarAppointment } from "@/features/calendar/types";

/**
 * Місяць. Кожна клітинка показує до 3 записів; перетягування переносить
 * запис на іншу дату, зберігаючи час.
 */
export function MonthGrid({
  days,
  anchor,
  appointments,
  canEdit,
  canCreate,
  onOpen,
  onCreate,
  onMoveToDate,
  onSelectDay,
}: {
  days: Date[];
  anchor: Date;
  appointments: CalendarAppointment[];
  canEdit: boolean;
  canCreate: boolean;
  onOpen: (appointment: CalendarAppointment) => void;
  onCreate: (date: Date) => void;
  onMoveToDate: (id: string, date: Date) => void;
  onSelectDay: (date: Date) => void;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const appointment of appointments) {
      const key = toDateKey(new Date(appointment.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appointment);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
    return map;
  }, [appointments]);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
        {WEEKDAYS_SHORT_UK.slice(1).concat(WEEKDAYS_SHORT_UK[0]).map((label) => (
          <div
            key={label}
            className="py-2.5 text-center text-[11px] font-medium text-[var(--fg-subtle)] uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((date) => {
          const key = toDateKey(date);
          const items = byDay.get(key) ?? [];
          const outside = date.getMonth() !== anchor.getMonth();
          const today = isToday(date);

          return (
            <div
              key={key}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                setOverKey(key);
              }}
              onDragLeave={() => setOverKey((prev) => (prev === key ? null : prev))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId) onMoveToDate(dragId, date);
                setDragId(null);
                setOverKey(null);
              }}
              onDoubleClick={() => canCreate && onCreate(date)}
              className={cn(
                "min-h-[112px] border-r border-b border-[var(--border)] p-1.5 transition-colors last:border-r-0",
                outside && "bg-[var(--surface-2)]/60",
                overKey === key && "bg-[var(--primary-soft)]",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <button
                  type="button"
                  onClick={() => onSelectDay(date)}
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12.5px] font-semibold tabular-nums transition-colors",
                    today
                      ? "bg-[var(--primary)] text-white"
                      : outside
                        ? "text-[var(--fg-subtle)] hover:bg-[var(--surface-hover)]"
                        : "text-[var(--fg)] hover:bg-[var(--surface-hover)]",
                  )}
                >
                  {date.getDate()}
                </button>
                {items.length > 0 && (
                  <span className="text-[10.5px] font-medium text-[var(--fg-subtle)] tabular-nums">
                    {items.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {items.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    draggable={canEdit}
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverKey(null);
                    }}
                    onClick={() => onOpen(item)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:brightness-95",
                      canEdit && "cursor-grab active:cursor-grabbing",
                      (item.status === "CANCELLED" || item.status === "NO_SHOW") && "opacity-55",
                    )}
                    style={{
                      background: `color-mix(in oklab, ${item.service.color} 15%, var(--surface))`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: item.service.color }}
                      aria-hidden
                    />
                    <span className="shrink-0 text-[10.5px] font-semibold text-[var(--fg-muted)] tabular-nums">
                      {formatTime(new Date(item.startAt))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--fg)]">
                      {item.client.firstName}
                    </span>
                  </button>
                ))}
                {items.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(date)}
                    className="w-full px-1.5 text-left text-[10.5px] font-medium text-[var(--primary)] hover:underline"
                  >
                    ще {items.length - 3}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function monthDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  // Завжди 6 повних тижнів — висота сітки не стрибає між місяцями.
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push(date);
  }
  return days;
}

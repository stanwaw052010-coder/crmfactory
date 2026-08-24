"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/tabs";
import { Select } from "@/components/ui/input";
import { APPOINTMENT_STATUS_LABELS } from "@/components/shared/status";
import type { CalendarEmployee, CalendarService } from "@/features/calendar/types";
import { MONTHS_NOM_UK, formatDateUk, startOfWeek, addDays } from "@/lib/time";

const VIEWS = [
  { value: "day", label: "День" },
  { value: "week", label: "Тиждень" },
  { value: "month", label: "Місяць" },
];

export function CalendarToolbar({
  view,
  anchor,
  filters,
  employees,
  services,
  lockedEmployeeId,
  onViewChange,
  onNavigate,
  onToday,
  onFilterChange,
}: {
  view: "day" | "week" | "month";
  anchor: Date;
  filters: { employee: string; service: string; status: string };
  employees: CalendarEmployee[];
  services: CalendarService[];
  lockedEmployeeId: string | null;
  onViewChange: (view: "day" | "week" | "month") => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onFilterChange: (key: "employee" | "service" | "status", value: string) => void;
}) {
  const title =
    view === "day"
      ? formatDateUk(anchor, { year: true, weekday: true })
      : view === "week"
        ? (() => {
            const start = startOfWeek(anchor);
            const end = addDays(start, 6);
            return `${start.getDate()} – ${formatDateUk(end, { year: true })}`;
          })()
        : `${MONTHS_NOM_UK[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const hasFilters =
    filters.employee !== "all" || filters.service !== "all" || filters.status !== "all";

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon-sm" onClick={() => onNavigate(-1)} aria-label="Назад">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => onNavigate(1)} aria-label="Вперед">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToday} className="ml-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Сьогодні
          </Button>
        </div>

        <h2 className="text-[15px] font-semibold text-[var(--fg)] capitalize sm:text-base">
          {title}
        </h2>

        <SegmentedControl
          className="ml-auto"
          size="sm"
          options={VIEWS}
          value={view}
          onChange={(value) => onViewChange(value as "day" | "week" | "month")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--fg-subtle)]">
          <Filter className="h-3.5 w-3.5" />
          Фільтри
        </span>

        {!lockedEmployeeId && (
          <Select
            className="h-8 w-auto min-w-[150px] text-[13px]"
            value={filters.employee}
            onChange={(e) => onFilterChange("employee", e.target.value)}
            aria-label="Співробітник"
          >
            <option value="all">Усі співробітники</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          className="h-8 w-auto min-w-[140px] text-[13px]"
          value={filters.service}
          onChange={(e) => onFilterChange("service", e.target.value)}
          aria-label="Послуга"
        >
          <option value="all">Усі послуги</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-auto min-w-[140px] text-[13px]"
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          aria-label="Статус"
        >
          <option value="all">Усі статуси</option>
          {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onFilterChange("employee", "all");
              onFilterChange("service", "all");
              onFilterChange("status", "all");
            }}
          >
            <X className="h-3.5 w-3.5" />
            Скинути
          </Button>
        )}
      </div>
    </div>
  );
}

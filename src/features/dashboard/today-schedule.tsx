"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, Clock } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentStatusBadge } from "@/components/shared/status";
import { useNow } from "@/hooks/use-now";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import { cn, pluralUk } from "@/lib/utils";

export type ScheduleItem = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priceCents: number;
  client: { id: string; firstName: string; lastName: string | null };
  service: { name: string; color: string };
  employee: { name: string; color: string; avatarUrl: string | null };
};

/** «через 20 хв» / «за 5 хв» — тільки для найближчої години. */
function untilLabel(startAt: Date, now: number): string | null {
  const minutes = Math.round((startAt.getTime() - now) / 60_000);
  if (minutes <= 0 || minutes > 90) return null;
  if (minutes < 1) return "ось-ось";
  if (minutes < 60) return `через ${minutes} ${pluralUk(minutes, "хвилину", "хвилини", "хвилин")}`;
  return "через годину";
}

export function TodaySchedule({
  items,
  currency,
  canCreate,
  serverNow,
}: {
  items: ScheduleItem[];
  currency: string;
  canCreate: boolean;
  /** Час сервера на момент рендеру — стартова точка для живого годинника. */
  serverNow: number;
}) {
  const now = useNow(serverNow);

  // Індекс першого запису, який ще не завершився: перед ним малюємо
  // лінію «зараз». Так видно межу дня, навіть коли поточної події немає
  // (перерва між клієнтками — це теж інформація).
  const nextIndex = items.findIndex((item) => item.endAt.getTime() > now);
  const anyRunning = items.some(
    (item) => item.startAt.getTime() <= now && item.endAt.getTime() >= now,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Розклад на сьогодні"
        description={
          items.length > 0
            ? `${items.length} ${pluralUk(items.length, "запис", "записи", "записів")}`
            : undefined
        }
        action={
          <Link href="/calendar">
            <Button variant="ghost" size="sm">
              Весь календар
            </Button>
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Clock}
          title="На сьогодні записів немає"
          description="Створіть перший запис — і він одразу з'явиться в календарі та в історії клієнта."
          action={
            canCreate ? (
              <Link href="/calendar?new=1">
                <Button size="sm">
                  <CalendarPlus className="h-4 w-4" />
                  Створити запис
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item, index) => {
            const start = item.startAt.getTime();
            const end = item.endAt.getTime();
            const isPast = end < now;
            const isNow = start <= now && end >= now;
            const until = untilLabel(item.startAt, now);

            return (
              <React.Fragment key={item.id}>
                {/* Лінія «зараз» — тільки коли салон у перерві. Під час
                    візиту межу і так показує підсвічений рядок. */}
                {index === nextIndex && !anyRunning && (
                  <li aria-hidden className="relative">
                    <div className="flex items-center gap-2 px-5 py-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ring-out absolute inline-flex h-full w-full rounded-full bg-[var(--danger)]" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
                      </span>
                      <span className="h-px flex-1 bg-[var(--danger)]/40" />
                      <span className="text-[10.5px] font-medium tracking-wide text-[var(--danger)] uppercase">
                        зараз
                      </span>
                    </div>
                  </li>
                )}

                <li className={cn(isPast && "opacity-55 transition-opacity")}>
                  <Link
                    href={`/calendar?appointment=${item.id}`}
                    className={cn(
                      "relative flex items-center gap-3 px-5 py-3.5 transition-colors sm:gap-4",
                      isNow
                        ? "bg-[var(--primary-soft)] hover:brightness-95 dark:hover:brightness-110"
                        : "hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    {isNow && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[3px] bg-[var(--primary)]"
                      />
                    )}

                    <div className="w-12 shrink-0">
                      <p
                        className={cn(
                          "text-[14px] font-semibold tabular-nums",
                          isNow
                            ? "text-[var(--primary)]"
                            : isPast
                              ? "text-[var(--fg-subtle)]"
                              : "text-[var(--fg)]",
                        )}
                      >
                        {formatTime(item.startAt)}
                      </p>
                      <p className="text-[11.5px] text-[var(--fg-subtle)] tabular-nums">
                        {formatTime(item.endAt)}
                      </p>
                    </div>

                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ background: item.service.color }}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[14px] font-medium text-[var(--fg)]">
                        {item.client.firstName} {item.client.lastName ?? ""}
                        {isNow && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <span className="animate-pulse-dot h-1 w-1 rounded-full bg-white" />
                            йде зараз
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[12.5px] text-[var(--fg-muted)]">
                        {item.service.name}
                        {until && (
                          <span className="ml-1.5 font-medium text-[var(--primary)]">
                            · {until}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="hidden items-center gap-2 sm:flex">
                      <Avatar
                        name={item.employee.name}
                        src={item.employee.avatarUrl}
                        color={item.employee.color}
                        size="xs"
                      />
                      <span className="text-[12.5px] text-[var(--fg-muted)]">
                        {item.employee.name}
                      </span>
                    </div>

                    <span className="hidden w-16 text-right text-[13px] font-semibold text-[var(--fg)] tabular-nums md:block">
                      {formatMoney(item.priceCents, currency)}
                    </span>

                    <div className="shrink-0">
                      <AppointmentStatusBadge status={item.status} />
                    </div>
                  </Link>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

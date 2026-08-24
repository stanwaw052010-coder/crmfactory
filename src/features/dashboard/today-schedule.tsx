import Link from "next/link";
import { CalendarPlus, Clock } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentStatusBadge } from "@/components/shared/status";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";

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

export function TodaySchedule({
  items,
  currency,
  canCreate,
}: {
  items: ScheduleItem[];
  currency: string;
  canCreate: boolean;
}) {
  const now = new Date();

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Розклад на сьогодні"
        description={items.length > 0 ? `${items.length} записів` : undefined}
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
          {items.map((item) => {
            const isPast = item.endAt < now;
            const isNow = item.startAt <= now && item.endAt >= now;

            return (
              <li key={item.id}>
                <Link
                  href={`/calendar?appointment=${item.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-hover)] sm:gap-4"
                >
                  <div className="w-12 shrink-0">
                    <p
                      className={`text-[14px] font-semibold tabular-nums ${
                        isNow ? "text-[var(--primary)]" : isPast ? "text-[var(--fg-subtle)]" : "text-[var(--fg)]"
                      }`}
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
                    <p className="truncate text-[14px] font-medium text-[var(--fg)]">
                      {item.client.firstName} {item.client.lastName ?? ""}
                    </p>
                    <p className="truncate text-[12.5px] text-[var(--fg-muted)]">
                      {item.service.name}
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
            );
          })}
        </ul>
      )}
    </Card>
  );
}

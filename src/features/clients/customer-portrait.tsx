"use client";

import * as React from "react";
import { CalendarHeart, Repeat, Sparkles, UserRound } from "lucide-react";
import { pluralUk } from "@/lib/utils";

/**
 * Портрет клієнта: що він любить, до кого ходить, як часто.
 *
 * Ці три відповіді закривають майже всю підготовку до дзвінка. Раніше вони
 * лежали в базі, але щоб їх отримати, довелося б гортати список візитів
 * і рахувати в голові.
 */
export function CustomerPortrait({
  topServices,
  topEmployee,
  rhythmDays,
  visits,
}: {
  topServices: { name: string; count: number }[];
  topEmployee: { name: string; count: number } | null;
  rhythmDays: number | null;
  visits: number;
}) {
  const items: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }[] = [];

  if (topServices.length > 0) {
    items.push({
      icon: Sparkles,
      label: "Улюблені послуги",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {topServices.map((service) => (
            <span
              key={service.name}
              className="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[12px] text-[var(--fg)]"
            >
              {service.name}
              <span className="ml-1 text-[var(--fg-subtle)] tabular-nums">
                ×{service.count}
              </span>
            </span>
          ))}
        </span>
      ),
    });
  }

  if (topEmployee) {
    items.push({
      icon: UserRound,
      label: "Записується до",
      value: (
        <span className="text-[13px] text-[var(--fg)]">
          {topEmployee.name}
          <span className="ml-1.5 text-[12px] text-[var(--fg-subtle)]">
            {topEmployee.count} із {visits}{" "}
            {pluralUk(visits, "візиту", "візитів", "візитів")}
          </span>
        </span>
      ),
    });
  }

  if (rhythmDays !== null) {
    items.push({
      icon: Repeat,
      label: "Приходить",
      value: (
        <span className="text-[13px] text-[var(--fg)]">
          раз на {rhythmDays} {pluralUk(rhythmDays, "день", "дні", "днів")}
        </span>
      ),
    });
  }

  // Порожній портрет не показуємо: рамка з прочерками гірша за її відсутність.
  if (items.length === 0) return null;

  return (
    <div className="card p-5">
      <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
        <CalendarHeart className="h-3.5 w-3.5" />
        Портрет клієнта
      </p>
      <dl className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
            <div className="min-w-0 flex-1">
              <dt className="text-[12px] text-[var(--fg-muted)]">{item.label}</dt>
              <dd className="mt-0.5">{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

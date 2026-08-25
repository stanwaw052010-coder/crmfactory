"use client";

import * as React from "react";
import { CalendarCheck2, CalendarX2, StickyNote, UserPlus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatDateUk, formatTime } from "@/lib/time";

type TimelineKind = "visit" | "cancelled" | "payment" | "note" | "created";

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  at: Date;
  title: string;
  detail?: string | null;
};

const STYLES: Record<
  TimelineKind,
  { icon: React.ComponentType<{ className?: string }>; fg: string; bg: string }
> = {
  visit: { icon: CalendarCheck2, fg: "var(--success)", bg: "var(--success-soft)" },
  cancelled: { icon: CalendarX2, fg: "var(--danger)", bg: "var(--danger-soft)" },
  payment: { icon: Wallet, fg: "var(--primary)", bg: "var(--primary-soft)" },
  note: { icon: StickyNote, fg: "var(--warning)", bg: "var(--warning-soft)" },
  created: { icon: UserPlus, fg: "var(--info)", bg: "var(--info-soft)" },
};

/**
 * Єдина стрічка всього, що було з клієнтом.
 *
 * Раніше візити, оплати й нотатки жили в окремих вкладках, і щоб
 * відновити картину («приходила, потім скасувала, потім зникла»),
 * доводилося перемикатися між ними й зіставляти дати в голові.
 * Тут усе в одному порядку — хронологічному.
 */
export function ClientTimeline({ events }: { events: TimelineEvent[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? events : events.slice(0, 8);

  if (events.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-[var(--fg-muted)]">
        Подій ще немає.
      </p>
    );
  }

  return (
    <div className="p-5">
      <ol className="relative space-y-4">
        {visible.map((event, index) => {
          const style = STYLES[event.kind];
          const Icon = style.icon;
          const isLast = index === visible.length - 1;

          return (
            <li key={event.id} className="relative flex gap-3.5">
              {/* Лінія між подіями — не малюємо після останньої, інакше
                  стрічка виглядає обірваною. */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute top-8 left-[15px] h-[calc(100%-14px)] w-px bg-[var(--border)]"
                />
              )}

              <span
                className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: style.bg, color: style.fg }}
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13.5px] font-medium text-[var(--fg)]">{event.title}</p>
                {event.detail && (
                  <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">{event.detail}</p>
                )}
                <p className="mt-0.5 text-[11.5px] text-[var(--fg-subtle)] tabular-nums">
                  {formatDateUk(event.at, { year: true })} · {formatTime(event.at)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {events.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            "mt-4 w-full rounded-lg border border-[var(--border)] py-2 text-[13px] font-medium",
            "text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
          )}
        >
          {expanded ? "Згорнути" : `Показати ще ${events.length - 8}`}
        </button>
      )}
    </div>
  );
}

/** Збірка стрічки з різних джерел — в одному місці, щоб порядок не розповзався. */
export function buildTimeline(params: {
  createdAt: Date;
  appointments: {
    id: string;
    startAt: Date;
    status: string;
    priceCents: number;
    service: { name: string } | null;
    employee: { name: string } | null;
  }[];
  payments: { id: string; paidAt: Date; amountCents: number; method: string }[];
  notes: { id: string; createdAt: Date; body: string }[];
  currency: string;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const appointment of params.appointments) {
    const failed = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";
    events.push({
      id: `a-${appointment.id}`,
      kind: failed ? "cancelled" : "visit",
      at: appointment.startAt,
      title: appointment.service?.name ?? "Візит",
      detail: [
        appointment.employee?.name,
        appointment.status === "NO_SHOW"
          ? "не прийшов"
          : appointment.status === "CANCELLED"
            ? "скасовано"
            : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const payment of params.payments) {
    events.push({
      id: `p-${payment.id}`,
      kind: "payment",
      at: payment.paidAt,
      title: `Оплата ${formatMoney(payment.amountCents, params.currency)}`,
      detail: METHOD_LABELS[payment.method] ?? null,
    });
  }

  for (const note of params.notes) {
    events.push({
      id: `n-${note.id}`,
      kind: "note",
      at: note.createdAt,
      title: "Нотатка",
      detail: note.body.length > 120 ? `${note.body.slice(0, 120)}…` : note.body,
    });
  }

  events.push({
    id: "created",
    kind: "created",
    at: params.createdAt,
    title: "З'явився в базі",
  });

  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Готівка",
  CARD: "Картка",
  ONLINE: "Онлайн",
  TRANSFER: "Переказ",
  CERTIFICATE: "Сертифікат",
};

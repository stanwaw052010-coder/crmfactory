"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  Clock,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dropdown } from "@/components/ui/dropdown";
import { relativeUk } from "@/lib/time";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BOOKING_CREATED: CalendarCheck,
  BOOKING_CANCELLED: CalendarX,
  APPOINTMENT_REMINDER: Clock,
  CLIENT_CREATED: UserPlus,
  PAYMENT_RECEIVED: Wallet,
  SYSTEM: Bell,
};

const TONES: Record<string, string> = {
  BOOKING_CREATED: "text-[var(--success)] bg-[var(--success-soft)]",
  BOOKING_CANCELLED: "text-[var(--danger)] bg-[var(--danger-soft)]",
  APPOINTMENT_REMINDER: "text-[var(--warning)] bg-[var(--warning-soft)]",
  CLIENT_CREATED: "text-[var(--info)] bg-[var(--info-soft)]",
  PAYMENT_RECEIVED: "text-[var(--success)] bg-[var(--success-soft)]",
  SYSTEM: "text-[var(--primary)] bg-[var(--primary-soft)]",
};

function hrefFor(item: NotificationItem) {
  if (item.entityType === "appointment") return `/calendar?appointment=${item.entityId}`;
  if (item.entityType === "client") return `/clients/${item.entityId}`;
  return "/dashboard";
}

export function NotificationsBell({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const unread = items.filter((item) => !item.readAt).length;

  const markAll = async () => {
    setPending(true);
    await markAllNotificationsReadAction();
    setPending(false);
    router.refresh();
  };

  return (
    <Dropdown
      width="w-[360px]"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Сповіщення${unread ? `, непрочитаних: ${unread}` : ""}`}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9.5px] font-bold text-white ring-2 ring-[var(--surface)]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 py-2">
            <p className="text-[13px] font-semibold text-[var(--fg)]">Сповіщення</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={pending}
                className="flex items-center gap-1 text-[12px] font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Прочитати все
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-[var(--fg-subtle)]" />
                <p className="text-[13px] text-[var(--fg-muted)]">Поки що тихо</p>
                <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
                  Тут з&apos;являться нові записи та події
                </p>
              </div>
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                return (
                  <Link
                    key={item.id}
                    href={hrefFor(item)}
                    onClick={() => {
                      close();
                      if (!item.readAt) void markNotificationReadAction(item.id);
                    }}
                    className={cn(
                      "flex gap-3 rounded-[10px] px-2.5 py-2.5 transition-colors hover:bg-[var(--surface-hover)]",
                      !item.readAt && "bg-[var(--primary-soft)]/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                        TONES[item.type] ?? TONES.SYSTEM,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-[var(--fg)]">
                          {item.title}
                        </span>
                        {!item.readAt && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                        )}
                      </span>
                      {item.body && (
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--fg-muted)]">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11.5px] text-[var(--fg-subtle)]">
                        {relativeUk(new Date(item.createdAt))}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

"use client";

import Link from "next/link";
import { CalendarPlus, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { NotificationsBell, type NotificationItem } from "@/components/layout/notifications-bell";

export function Topbar({
  notifications,
  bookingUrl,
  canCreateAppointment,
}: {
  notifications: NotificationItem[];
  bookingUrl: string;
  canCreateAppointment: boolean;
}) {
  const openCommandMenu = () => {
    window.dispatchEvent(new CustomEvent("crmf:open-command-menu"));
  };

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 backdrop-blur-xl sm:px-6">
      <Link href="/dashboard" className="md:hidden">
        <Logo size="sm" />
      </Link>

      <button
        type="button"
        onClick={openCommandMenu}
        className="hidden h-9 w-full max-w-xs items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-left text-[13px] text-[var(--fg-subtle)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] md:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1">Пошук…</span>
        <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-medium">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={openCommandMenu}
          aria-label="Пошук"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] md:hidden"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        <a
          href={bookingUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] lg:flex"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Сторінка запису
        </a>

        <ThemeToggle compact />
        <NotificationsBell items={notifications} />

        {canCreateAppointment && (
          <Link href="/calendar?new=1" className="ml-1">
            <Button size="sm">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Новий запис</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

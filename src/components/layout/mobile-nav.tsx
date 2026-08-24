"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, LayoutDashboard, MoreHorizontal, Plus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

const PRIMARY = [
  { href: "/dashboard", label: "Головна", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/calendar", label: "Записи", icon: CalendarDays, permission: "calendar.view" },
  { href: "/clients", label: "Клієнти", icon: Users, permission: "client.view" },
];

/** Нижня навігація на мобільному: 3 основні розділи + «Створити» + «Ще». */
export function MobileNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const primary = PRIMARY.filter((item) => permissions.includes(item.permission));
  const rest = NAV_ITEMS.filter(
    (item) => permissions.includes(item.permission) && !primary.some((p) => p.href === item.href),
  );
  const canCreate = permissions.includes("appointment.create");

  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl md:hidden">
        <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {primary.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors",
                  active ? "text-[var(--primary)]" : "text-[var(--fg-subtle)]",
                )}
              >
                <Icon className="h-[20px] w-[20px]" />
                {item.label}
              </Link>
            );
          })}

          {canCreate && (
            <Link
              href="/calendar?new=1"
              className="flex flex-1 flex-col items-center justify-center py-1.5"
              aria-label="Створити запис"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-[var(--shadow-brand)]">
                <Plus className="h-5 w-5" />
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium text-[var(--fg-subtle)]"
          >
            <MoreHorizontal className="h-[20px] w-[20px]" />
            Ще
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 bottom-0 rounded-t-[22px] border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-[15px] font-semibold text-[var(--fg)]">Усі розділи</p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Закрити"
                  className="rounded-lg p-1.5 text-[var(--fg-subtle)] hover:bg-[var(--surface-hover)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 pb-6">
                {rest.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-[14px] border border-[var(--border)] px-2 py-4 text-[12px] font-medium transition-colors",
                        active
                          ? "border-transparent bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "bg-[var(--surface-2)] text-[var(--fg-muted)]",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounced } from "@/hooks/use-debounced";
import { useIsClient } from "@/hooks/use-is-client";
import { searchAction } from "@/server/actions/search";
import type { SearchResult } from "@/server/queries/search";

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  group: string;
};

const TYPE_META: Record<SearchResult["type"], { icon: React.ComponentType<{ className?: string }>; group: string }> = {
  client: { icon: Users, group: "Клієнти" },
  appointment: { icon: CalendarDays, group: "Записи" },
  employee: { icon: UserRound, group: "Команда" },
  service: { icon: Sparkles, group: "Послуги" },
};

/**
 * Командне меню (⌘K / Ctrl+K).
 * Пошук іде на сервер із debounce — інтерфейс не чекає на кожну літеру.
 */
export function CommandMenu({ permissions }: { permissions: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, startSearch] = React.useTransition();
  const [index, setIndex] = React.useState(0);
  const mounted = useIsClient();
  const debounced = useDebounced(query, 220);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("crmf:open-command-menu", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("crmf:open-command-menu", onOpen);
    };
  }, []);

  // Закрили меню — скидаємо пошук. Під час рендеру, без ефекту.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setQuery("");
      setResults([]);
      setIndex(0);
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      startSearch(() => setResults([]));
      return;
    }
    startSearch(async () => {
      const res = await searchAction(debounced);
      if (cancelled) return;
      setResults(res.ok ? res.data : []);
      setIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const navCommands = React.useMemo<Command[]>(() => {
    const all: Command[] = [
      { id: "new-appointment", label: "Створити запис", hint: "N", icon: CalendarPlus, href: "/calendar?new=1", group: "Дії" },
      { id: "new-client", label: "Додати клієнта", hint: "C", icon: UserPlus, href: "/clients?new=1", group: "Дії" },
      { id: "dashboard", label: "Головна", icon: LayoutDashboard, href: "/dashboard", group: "Перейти" },
      { id: "calendar", label: "Записи", icon: CalendarDays, href: "/calendar", group: "Перейти" },
      { id: "clients", label: "Клієнти", icon: Users, href: "/clients", group: "Перейти" },
      { id: "services", label: "Послуги", icon: Sparkles, href: "/services", group: "Перейти" },
      { id: "employees", label: "Команда", icon: UserRound, href: "/employees", group: "Перейти" },
      { id: "pipeline", label: "Воронка", icon: KanbanSquare, href: "/pipeline", group: "Перейти" },
      { id: "sales", label: "Продажі", icon: CreditCard, href: "/sales", group: "Перейти" },
      { id: "analytics", label: "Аналітика", icon: BarChart3, href: "/analytics", group: "Перейти" },
      { id: "settings", label: "Налаштування", icon: Settings, href: "/settings", group: "Перейти" },
    ];
    const required: Record<string, string> = {
      "new-appointment": "appointment.create",
      "new-client": "client.create",
      clients: "client.view",
      services: "service.view",
      employees: "employee.view",
      pipeline: "pipeline.view",
      sales: "payment.view",
      analytics: "analytics.view",
      settings: "settings.view",
    };
    return all.filter((c) => !required[c.id] || permissions.includes(required[c.id]));
  }, [permissions]);

  const commands = React.useMemo<Command[]>(() => {
    if (query.trim().length >= 2) {
      const found: Command[] = results.map((r) => ({
        id: `${r.type}-${r.id}`,
        label: r.title,
        hint: r.subtitle,
        icon: TYPE_META[r.type].icon,
        href: r.href,
        group: TYPE_META[r.type].group,
      }));
      const filteredNav = navCommands.filter((c) =>
        c.label.toLowerCase().includes(query.trim().toLowerCase()),
      );
      return [...found, ...filteredNav];
    }
    return navCommands;
  }, [query, results, navCommands]);

  const run = React.useCallback(
    (command: Command) => {
      setOpen(false);
      if (command.href) router.push(command.href);
      command.action?.();
    },
    [router],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, commands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && commands[index]) {
        e.preventDefault();
        run(commands[index]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, commands, index, run]);

  if (!mounted) return null;

  const groups = commands.reduce<Record<string, Command[]>>((acc, command) => {
    (acc[command.group] ??= []).push(command);
    return acc;
  }, {});

  let flatIndex = -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
              <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук у crm.factory…"
                className="h-13 w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-[var(--fg-subtle)]"
              />
              {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--fg-subtle)]" />}
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {commands.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[13px] text-[var(--fg-muted)]">
                    {query.trim().length < 2
                      ? "Введіть щонайменше 2 символи"
                      : `Нічого не знайдено за запитом «${query}»`}
                  </p>
                </div>
              ) : (
                Object.entries(groups).map(([group, items]) => (
                  <div key={group} className="mb-1">
                    <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase">
                      {group}
                    </p>
                    {items.map((command) => {
                      flatIndex += 1;
                      const current = flatIndex;
                      const Icon = command.icon;
                      return (
                        <button
                          key={command.id}
                          type="button"
                          onMouseEnter={() => setIndex(current)}
                          onClick={() => run(command)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left transition-colors",
                            index === current
                              ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                              : "text-[var(--fg)] hover:bg-[var(--surface-hover)]",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-70" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium">
                              {command.label}
                            </span>
                            {command.hint && (
                              <span className="block truncate text-[12px] text-[var(--fg-subtle)]">
                                {command.hint}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-[11.5px] text-[var(--fg-subtle)]">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> навігація
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> відкрити
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Kbd>esc</Kbd> закрити
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-[var(--fg-muted)]">
      {children}
    </kbd>
  );
}

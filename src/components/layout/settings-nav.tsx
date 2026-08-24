"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, CalendarClock, CreditCard, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Бізнес", icon: Building2, permission: "settings.view", exact: true },
  { href: "/settings/booking", label: "Онлайн-запис", icon: CalendarClock, permission: "settings.view" },
  { href: "/settings/team", label: "Команда і доступи", icon: Users, permission: "team.manage" },
  { href: "/settings/notifications", label: "Сповіщення", icon: Bell, permission: "settings.manage" },
  { href: "/settings/billing", label: "Тариф", icon: CreditCard, permission: "billing.manage" },
  { href: "/settings/profile", label: "Мій профіль", icon: UserCog, permission: "dashboard.view" },
];

export function SettingsNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => permissions.includes(item.permission));

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              active
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

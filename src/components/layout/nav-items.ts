import {
  BarChart3,
  CalendarDays,
  CreditCard,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  /** Точний збіг шляху (для /dashboard, щоб не підсвічувався всюди). */
  exact?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Головна", icon: LayoutDashboard, permission: "dashboard.view", exact: true },
  { href: "/calendar", label: "Записи", icon: CalendarDays, permission: "calendar.view" },
  { href: "/clients", label: "Клієнти", icon: Users, permission: "client.view" },
  { href: "/services", label: "Послуги", icon: Sparkles, permission: "service.view" },
  { href: "/employees", label: "Команда", icon: UserRound, permission: "employee.view" },
  { href: "/pipeline", label: "Воронка", icon: KanbanSquare, permission: "pipeline.view" },
  { href: "/sales", label: "Продажі", icon: CreditCard, permission: "payment.view" },
  { href: "/analytics", label: "Аналітика", icon: BarChart3, permission: "analytics.view" },
  { href: "/settings", label: "Налаштування", icon: Settings, permission: "settings.view" },
];

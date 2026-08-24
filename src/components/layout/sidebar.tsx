"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronsUpDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  UserCog,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Logo, LogoMark, SystemStatus } from "@/components/shared/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ROLE_LABELS } from "@/lib/permissions";
import { logoutAction, switchOrganizationAction } from "@/server/actions/auth";
import type { Role } from "@prisma/client";

export type SidebarProps = {
  user: { name: string; email: string; avatarUrl: string | null; isSuperAdmin: boolean };
  organization: { id: string; name: string; logoUrl: string | null; plan: string };
  organizations: { id: string; name: string; logoUrl: string | null }[];
  role: Role;
  permissions: string[];
};

const STORAGE_KEY = "crmf-sidebar-collapsed";
const SIDEBAR_EVENT = "crmf:sidebar-toggle";

function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const collapsed = React.useSyncExternalStore(
    subscribeSidebar,
    readCollapsed,
    () => false,
  );

  const toggle = () => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      /* приватний режим — стан не запам'ятається, але UI працює */
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  const items = NAV_ITEMS.filter((item) => props.permissions.includes(item.permission));

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="no-print sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-[var(--sidebar-line)] bg-[var(--sidebar)] md:flex"
    >
      {/* Бренд */}
      <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="flex min-w-0 items-center">
          {collapsed ? <LogoMark /> : <Logo size="sm" />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Згорнути меню"
            className="ml-auto rounded-lg p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Розгорнути меню"
          className="mx-auto mb-2 rounded-lg p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Навігація */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          const link = (
            <Link
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium",
                "transition-colors duration-150",
                collapsed && "justify-center px-0",
                active
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--primary)]"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          return (
            <div key={item.href}>
              {collapsed ? (
                <Tooltip label={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </div>
          );
        })}

        {props.user.isSuperAdmin && (
          <Link
            href="/admin"
            className={cn(
              "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium",
              "text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
              collapsed && "justify-center px-0",
              pathname.startsWith("/admin") && "bg-[var(--primary-soft)] text-[var(--primary)]",
            )}
          >
            <Shield className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Super Admin</span>}
          </Link>
        )}
      </nav>

      {/* Workspace + профіль */}
      <div className="border-t border-[var(--sidebar-line)] p-3">
        <Dropdown
          width="w-64"
          align="start"
          trigger={({ toggle: openMenu }) => (
            <button
              type="button"
              onClick={openMenu}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[var(--surface-hover)]",
                collapsed && "justify-center",
              )}
            >
              <Avatar name={props.organization.name} src={props.organization.logoUrl} size="sm" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-[var(--fg-subtle)]">
                      Workspace
                    </span>
                    <span className="block truncate text-[13px] font-semibold text-[var(--fg)]">
                      {props.organization.name}
                    </span>
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
                </>
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownLabel>Ваші workspace</DropdownLabel>
              {props.organizations.map((org) => (
                <DropdownItem
                  key={org.id}
                  active={org.id === props.organization.id}
                  onClick={() => {
                    close();
                    if (org.id !== props.organization.id) void switchOrganizationAction(org.id);
                  }}
                >
                  <span className="flex w-full items-center gap-2">
                    <Avatar name={org.name} src={org.logoUrl} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{org.name}</span>
                    {org.id === props.organization.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <Link href="/workspace/new" onClick={close}>
                <DropdownItem icon={Plus}>Створити workspace</DropdownItem>
              </Link>
            </>
          )}
        </Dropdown>

        <Dropdown
          width="w-60"
          align="start"
          trigger={({ toggle: openMenu }) => (
            <button
              type="button"
              onClick={openMenu}
              className={cn(
                "mt-1 flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[var(--surface-hover)]",
                collapsed && "justify-center",
              )}
            >
              <Avatar name={props.user.name} src={props.user.avatarUrl} size="sm" />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--fg)]">
                    {props.user.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-[var(--fg-subtle)]">
                    {ROLE_LABELS[props.role]}
                  </span>
                </span>
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 py-2">
                <p className="truncate text-[13px] font-semibold text-[var(--fg)]">{props.user.name}</p>
                <p className="truncate text-[12px] text-[var(--fg-subtle)]">{props.user.email}</p>
              </div>
              <DropdownSeparator />
              <Link href="/settings/profile" onClick={close}>
                <DropdownItem icon={UserCog}>Мій профіль</DropdownItem>
              </Link>
              <Link href="/settings" onClick={close}>
                <DropdownItem icon={Settings}>Налаштування</DropdownItem>
              </Link>
              <DropdownSeparator />
              <form action={logoutAction}>
                <DropdownItem icon={LogOut} danger type="submit">
                  Вийти
                </DropdownItem>
              </form>
            </>
          )}
        </Dropdown>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2.5 px-2"
            >
              <SystemStatus />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

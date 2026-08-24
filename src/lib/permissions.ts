import type { Role } from "@prisma/client";

/**
 * Permission layer.
 *
 * Frontend ховає кнопки — це UX. Реальний захист живе на сервері:
 * кожна серверна дія викликає `requirePermission()` (див. lib/auth/context.ts).
 * Матриця нижче — єдине джерело істини для обох сторін.
 */

export const PERMISSIONS = [
  "dashboard.view",
  "calendar.view",
  "calendar.view_all",
  "appointment.create",
  "appointment.update",
  "appointment.delete",
  "client.view",
  "client.create",
  "client.update",
  "client.delete",
  "client.export",
  "service.view",
  "service.manage",
  "employee.view",
  "employee.manage",
  "schedule.manage",
  "schedule.manage_own",
  "payment.view",
  "payment.manage",
  "analytics.view",
  "pipeline.view",
  "pipeline.manage",
  "settings.view",
  "settings.manage",
  "team.manage",
  "billing.manage",
  "organization.delete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER_PERMISSIONS: Permission[] = [...PERMISSIONS];

const ADMIN_PERMISSIONS: Permission[] = PERMISSIONS.filter(
  (p) => p !== "organization.delete" && p !== "billing.manage",
);

const MANAGER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "calendar.view",
  "calendar.view_all",
  "appointment.create",
  "appointment.update",
  "appointment.delete",
  "client.view",
  "client.create",
  "client.update",
  "client.export",
  "service.view",
  "employee.view",
  "payment.view",
  "payment.manage",
  "analytics.view",
  "pipeline.view",
  "pipeline.manage",
  "settings.view",
];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "calendar.view",
  "appointment.create",
  "appointment.update",
  "client.view",
  "service.view",
  "employee.view",
  "schedule.manage_own",
  "pipeline.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: OWNER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Власник",
  ADMIN: "Адміністратор",
  MANAGER: "Менеджер",
  EMPLOYEE: "Співробітник",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Повний доступ, включно з білінгом і видаленням workspace",
  ADMIN: "Майже повний доступ: команда, послуги, налаштування",
  MANAGER: "Клієнти, записи, продажі та аналітика",
  EMPLOYEE: "Власний розклад і записи",
};

export type PermissionOverrideMap = Record<string, boolean>;

/**
 * Обчислює фінальний набір прав: базова роль + точкові override-и.
 * Super-admin платформи не отримує автоматичного доступу до чужих
 * організацій — це свідоме рішення (див. /admin, окремий read-only зріз).
 */
export function resolvePermissions(
  role: Role,
  overrides: PermissionOverrideMap = {},
): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const [permission, allowed] of Object.entries(overrides)) {
    if (!PERMISSIONS.includes(permission as Permission)) continue;
    if (allowed) set.add(permission as Permission);
    else set.delete(permission as Permission);
  }
  return set;
}

export function hasPermission(
  permissions: Set<Permission> | Permission[],
  permission: Permission,
): boolean {
  return permissions instanceof Set
    ? permissions.has(permission)
    : permissions.includes(permission);
}

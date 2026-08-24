import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { readActiveOrganization, readSession } from "@/lib/auth/session";
import {
  resolvePermissions,
  type Permission,
  type PermissionOverrideMap,
} from "@/lib/permissions";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
};

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  onboardingCompleted: boolean;
  plan: string;
};

export type AuthContext = {
  user: SessionUser;
  organization: OrgSummary;
  membership: { id: string; role: Role; employeeId: string | null };
  permissions: Set<Permission>;
  organizations: OrgSummary[];
};

export class PermissionDeniedError extends Error {
  constructor(public permission: Permission) {
    super(`Недостатньо прав: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

/** Поточний користувач без прив'язки до організації. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, avatarUrl: true, isSuperAdmin: true },
  });
  return user;
});

/**
 * Повний контекст: користувач + активна організація + права.
 * Обгорнуто в `cache()` — на один рендер робиться рівно один похід у БД.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      organization: { include: { subscription: { select: { plan: true } } } },
      overrides: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) return null;

  const activeId = await readActiveOrganization();
  const active =
    memberships.find((m) => m.organizationId === activeId) ?? memberships[0];

  const overrides: PermissionOverrideMap = Object.fromEntries(
    active.overrides.map((o) => [o.permission, o.allowed]),
  );

  const toSummary = (m: (typeof memberships)[number]): OrgSummary => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    currency: m.organization.currency,
    timezone: m.organization.timezone,
    logoUrl: m.organization.logoUrl,
    onboardingCompleted: m.organization.onboardingCompleted,
    plan: m.organization.subscription?.plan ?? "FREE",
  });

  return {
    user,
    organization: toSummary(active),
    membership: { id: active.id, role: active.role, employeeId: active.employeeId },
    permissions: resolvePermissions(active.role, overrides),
    organizations: memberships.map(toSummary),
  };
});

/** Для сторінок: якщо не авторизований — редірект на /login. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Для сторінок і серверних дій: перевіряє конкретне право.
 * Кидає PermissionDeniedError, який ловлять серверні дії
 * і перетворюють на дружнє повідомлення.
 */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.permissions.has(permission)) throw new PermissionDeniedError(permission);
  return ctx;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");
  return user;
}

/**
 * Співробітник із роллю EMPLOYEE бачить лише власні записи.
 * Повертає фільтр по employeeId або `undefined`, якщо доступ повний.
 */
export function ownEmployeeFilter(ctx: AuthContext): string | undefined {
  if (ctx.permissions.has("calendar.view_all")) return undefined;
  return ctx.membership.employeeId ?? "__none__";
}

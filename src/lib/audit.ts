import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/**
 * Аудит-лог. Пишеться після кожної зміни даних, ніколи не блокує основну
 * операцію: якщо лог не записався — користувач усе одно отримує результат.
 */
export async function audit(params: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const h = await headers();
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        meta: (params.meta ?? {}) as object,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] не вдалося записати подію", error);
  }
}

/** Клієнтський IP із заголовків проксі — для rate limit та логів. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Сповіщення всередині застосунку. Створюються для всієї організації
 * (userId = null) або адресно конкретному користувачу.
 */
export async function notify(params: {
  organizationId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    });
  } catch (error) {
    console.error("[notify] не вдалося створити сповіщення", error);
  }
}

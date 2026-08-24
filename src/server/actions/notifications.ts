"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/context";
import { ok, toActionError, type ActionResult } from "@/lib/errors";

export async function markNotificationReadAction(id: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requireAuth();
    await prisma.notification.updateMany({
      where: { id, organizationId: ctx.organization.id },
      data: { readAt: new Date() },
    });
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<null>> {
  try {
    const ctx = await requireAuth();
    await prisma.notification.updateMany({
      where: { organizationId: ctx.organization.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

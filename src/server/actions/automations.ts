"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { automationSchema, type AutomationInput } from "@/lib/automation";

/** Скільки правил може мати салон. Більше — вже конструктор заради конструктора. */
const AUTOMATION_LIMIT = 20;

export async function saveAutomationAction(
  id: string | null,
  input: AutomationInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const parsed = automationSchema.parse(input);

    if (!id) {
      const existing = await prisma.automation.count({
        where: { organizationId: ctx.organization.id },
      });
      if (existing >= AUTOMATION_LIMIT) {
        return fail(`Більше ${AUTOMATION_LIMIT} правил не можна`);
      }
    }

    if (id) {
      const current = await prisma.automation.findUnique({ where: { id } });
      assertTenant(current, ctx.organization.id);
    }

    const data = {
      organizationId: ctx.organization.id,
      name: parsed.name,
      trigger: parsed.trigger,
      conditions: parsed.conditions,
      actions: parsed.actions,
      isActive: parsed.isActive,
    };

    const automation = id
      ? await prisma.automation.update({ where: { id }, data })
      : await prisma.automation.create({ data });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: id ? "automation.update" : "automation.create",
      entityType: "automation",
      entityId: automation.id,
    });

    revalidatePath("/settings/automations");
    return ok({ id: automation.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleAutomationAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const current = await prisma.automation.findUnique({ where: { id } });
    assertTenant(current, ctx.organization.id);

    await prisma.automation.update({ where: { id }, data: { isActive } });
    revalidatePath("/settings/automations");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAutomationAction(id: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");
    const current = await prisma.automation.findUnique({ where: { id } });
    assertTenant(current, ctx.organization.id);

    await prisma.automation.delete({ where: { id } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "automation.delete",
      entityType: "automation",
      entityId: id,
    });

    revalidatePath("/settings/automations");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

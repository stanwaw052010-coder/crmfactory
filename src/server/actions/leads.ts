"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import { leadMoveSchema, leadSchema } from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";

function parseLeadForm(formData: FormData) {
  return leadSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    stageId: formData.get("stageId"),
    clientId: formData.get("clientId"),
    serviceId: formData.get("serviceId"),
    assignedToId: formData.get("assignedToId"),
    valueCents: parseMoneyToCents(String(formData.get("value") ?? "0")),
    source: formData.get("source"),
    note: formData.get("note"),
  });
}

async function assertStage(stageId: string, organizationId: string) {
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  assertTenant(stage, organizationId);
}

export async function createLeadAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("pipeline.manage");
    const input = parseLeadForm(formData);
    await assertStage(input.stageId, ctx.organization.id);

    const count = await prisma.lead.count({
      where: { organizationId: ctx.organization.id, stageId: input.stageId },
    });

    await prisma.lead.create({
      data: {
        organizationId: ctx.organization.id,
        stageId: input.stageId,
        clientId: input.clientId ?? null,
        serviceId: input.serviceId ?? null,
        assignedToId: input.assignedToId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        source: input.source ?? null,
        valueCents: input.valueCents,
        note: input.note ?? null,
        position: count,
      },
    });

    revalidatePath("/pipeline");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateLeadAction(
  leadId: string,
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("pipeline.manage");
    const existing = await prisma.lead.findUnique({ where: { id: leadId } });
    assertTenant(existing, ctx.organization.id);

    const input = parseLeadForm(formData);
    await assertStage(input.stageId, ctx.organization.id);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        stageId: input.stageId,
        clientId: input.clientId ?? null,
        serviceId: input.serviceId ?? null,
        assignedToId: input.assignedToId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        source: input.source ?? null,
        valueCents: input.valueCents,
        note: input.note ?? null,
      },
    });
    revalidatePath("/pipeline");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** Drag & drop між колонками канбану. */
export async function moveLeadAction(input: {
  id: string;
  stageId: string;
  position: number;
}): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("pipeline.manage");
    const parsed = leadMoveSchema.parse(input);

    const lead = await prisma.lead.findUnique({ where: { id: parsed.id } });
    assertTenant(lead, ctx.organization.id);
    await assertStage(parsed.stageId, ctx.organization.id);

    await prisma.lead.update({
      where: { id: parsed.id },
      data: { stageId: parsed.stageId, position: parsed.position },
    });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "lead.move",
      entityType: "lead",
      entityId: parsed.id,
      meta: { stageId: parsed.stageId },
    });
    revalidatePath("/pipeline");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteLeadAction(leadId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("pipeline.manage");
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    assertTenant(lead, ctx.organization.id);
    await prisma.lead.delete({ where: { id: leadId } });
    revalidatePath("/pipeline");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** Створює клієнта з ліда й переносить його далі по воронці. */
export async function convertLeadToClientAction(leadId: string): Promise<ActionResult<{ clientId: string }>> {
  try {
    const ctx = await requirePermission("pipeline.manage");
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    assertTenant(lead, ctx.organization.id);
    if (lead!.clientId) return fail("Лід уже пов'язаний із клієнтом");

    const [firstName, ...rest] = lead!.name.split(" ");
    const client = await prisma.client.create({
      data: {
        organizationId: ctx.organization.id,
        firstName: firstName || lead!.name,
        lastName: rest.join(" ") || null,
        phone: lead!.phone,
        email: lead!.email,
        source: lead!.source,
        status: "NEW",
      },
    });

    await prisma.lead.update({ where: { id: leadId }, data: { clientId: client.id } });
    revalidatePath("/pipeline");
    revalidatePath("/clients");
    return ok({ clientId: client.id });
  } catch (error) {
    return toActionError(error);
  }
}

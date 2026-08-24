"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import { paymentSchema } from "@/lib/validation";
import { ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";

export async function createPaymentAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("payment.manage");
    const input = paymentSchema.parse({
      appointmentId: formData.get("appointmentId"),
      clientId: formData.get("clientId"),
      employeeId: formData.get("employeeId"),
      amountCents: parseMoneyToCents(String(formData.get("amount") ?? "0")),
      method: formData.get("method") || "CASH",
      status: formData.get("status") || "PAID",
      paidAt: formData.get("paidAt") || undefined,
      note: formData.get("note"),
    });

    if (input.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
      });
      assertTenant(appointment, ctx.organization.id);
    }
    if (input.clientId) {
      const client = await prisma.client.findUnique({ where: { id: input.clientId } });
      assertTenant(client, ctx.organization.id);
    }
    if (input.employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
      assertTenant(employee, ctx.organization.id);
    }

    const payment = await prisma.payment.create({
      data: {
        organizationId: ctx.organization.id,
        appointmentId: input.appointmentId ?? null,
        clientId: input.clientId ?? null,
        employeeId: input.employeeId ?? null,
        amountCents: input.amountCents,
        currency: ctx.organization.currency,
        method: input.method,
        status: input.status,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        note: input.note ?? null,
      },
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "payment.create",
      entityType: "payment",
      entityId: payment.id,
      meta: { amountCents: input.amountCents },
    });

    revalidatePath("/sales");
    revalidatePath("/dashboard");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePaymentStatusAction(
  paymentId: string,
  status: "PAID" | "PENDING" | "REFUNDED",
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("payment.manage");
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assertTenant(payment, ctx.organization.id);

    await prisma.payment.update({ where: { id: paymentId }, data: { status } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "payment.status",
      entityType: "payment",
      entityId: paymentId,
      meta: { status },
    });
    revalidatePath("/sales");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("payment.manage");
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assertTenant(payment, ctx.organization.id);
    await prisma.payment.delete({ where: { id: paymentId } });
    revalidatePath("/sales");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

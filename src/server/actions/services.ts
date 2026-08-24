"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import { serviceCategorySchema, serviceSchema } from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";

function parseServiceForm(formData: FormData) {
  return serviceSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    durationMin: formData.get("durationMin"),
    bufferMin: formData.get("bufferMin") || 0,
    priceCents: parseMoneyToCents(String(formData.get("price") ?? "0")),
    color: formData.get("color") || "#2563EB",
    isActive: formData.get("isActive") !== "off",
    onlineBooking: formData.get("onlineBooking") !== "off",
    employeeIds: formData.getAll("employeeIds").map(String).filter(Boolean),
  });
}

/** Перевіряє, що всі співробітники належать цій же організації. */
async function assertEmployeesInOrg(employeeIds: string[], organizationId: string) {
  if (employeeIds.length === 0) return;
  const count = await prisma.employee.count({
    where: { id: { in: employeeIds }, organizationId },
  });
  if (count !== employeeIds.length) throw new Error("Некоректний список співробітників");
}

export async function createServiceAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("service.manage");
    const input = parseServiceForm(formData);
    await assertEmployeesInOrg(input.employeeIds, ctx.organization.id);

    if (input.categoryId) {
      const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
      assertTenant(category, ctx.organization.id);
    }

    const service = await prisma.service.create({
      data: {
        organizationId: ctx.organization.id,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        durationMin: input.durationMin,
        bufferMin: input.bufferMin,
        priceCents: input.priceCents,
        color: input.color,
        isActive: input.isActive,
        onlineBooking: input.onlineBooking,
        employees: {
          create: input.employeeIds.map((employeeId) => ({ employeeId })),
        },
      },
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "service.create",
      entityType: "service",
      entityId: service.id,
    });
    revalidatePath("/services");
    return ok({ id: service.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateServiceAction(
  serviceId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("service.manage");
    const input = parseServiceForm(formData);
    await assertEmployeesInOrg(input.employeeIds, ctx.organization.id);

    const existing = await prisma.service.findUnique({ where: { id: serviceId } });
    assertTenant(existing, ctx.organization.id);

    await prisma.$transaction([
      prisma.employeeService.deleteMany({ where: { serviceId } }),
      prisma.service.update({
        where: { id: serviceId },
        data: {
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId ?? null,
          durationMin: input.durationMin,
          bufferMin: input.bufferMin,
          priceCents: input.priceCents,
          color: input.color,
          isActive: input.isActive,
          onlineBooking: input.onlineBooking,
          employees: { create: input.employeeIds.map((employeeId) => ({ employeeId })) },
        },
      }),
    ]);

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "service.update",
      entityType: "service",
      entityId: serviceId,
    });
    revalidatePath("/services");
    return ok({ id: serviceId });
  } catch (error) {
    return toActionError(error);
  }
}

export async function duplicateServiceAction(serviceId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("service.manage");
    const source = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { employees: true },
    });
    assertTenant(source, ctx.organization.id);

    const copy = await prisma.service.create({
      data: {
        organizationId: ctx.organization.id,
        name: `${source!.name} (копія)`,
        description: source!.description,
        categoryId: source!.categoryId,
        durationMin: source!.durationMin,
        bufferMin: source!.bufferMin,
        priceCents: source!.priceCents,
        color: source!.color,
        isActive: source!.isActive,
        onlineBooking: source!.onlineBooking,
        employees: { create: source!.employees.map((e) => ({ employeeId: e.employeeId })) },
      },
    });
    revalidatePath("/services");
    return ok({ id: copy.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteServiceAction(serviceId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("service.manage");
    const existing = await prisma.service.findUnique({ where: { id: serviceId } });
    assertTenant(existing, ctx.organization.id);

    const used = await prisma.appointment.count({ where: { serviceId } });
    if (used > 0) {
      // Послугу з історією не видаляємо — інакше зникне частина фінансових даних.
      await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
      revalidatePath("/services");
      return fail(
        `Послугу використано в ${used} записах, тому її переведено в неактивні замість видалення.`,
      );
    }

    await prisma.service.delete({ where: { id: serviceId } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "service.delete",
      entityType: "service",
      entityId: serviceId,
    });
    revalidatePath("/services");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function createCategoryAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("service.manage");
    const input = serviceCategorySchema.parse({
      name: formData.get("name"),
      color: formData.get("color") || "#2563EB",
    });
    const count = await prisma.serviceCategory.count({
      where: { organizationId: ctx.organization.id },
    });
    await prisma.serviceCategory.create({
      data: {
        organizationId: ctx.organization.id,
        name: input.name,
        color: input.color,
        sortOrder: count,
      },
    });
    revalidatePath("/services");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("service.manage");
    const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
    assertTenant(category, ctx.organization.id);
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    revalidatePath("/services");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireAuth } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import {
  employeeSchema,
  inviteSchema,
  memberRoleSchema,
  scheduleExceptionSchema,
  scheduleSchema,
} from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { defaultSchedule } from "@/server/bootstrap";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

function parseEmployeeForm(formData: FormData) {
  return employeeSchema.parse({
    name: formData.get("name"),
    position: formData.get("position"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    color: formData.get("color") || "#2563EB",
    bio: formData.get("bio"),
    isActive: formData.get("isActive") !== "off",
    acceptsOnlineBooking: formData.get("acceptsOnlineBooking") !== "off",
    serviceIds: formData.getAll("serviceIds").map(String).filter(Boolean),
  });
}

async function assertServicesInOrg(serviceIds: string[], organizationId: string) {
  if (serviceIds.length === 0) return;
  const count = await prisma.service.count({ where: { id: { in: serviceIds }, organizationId } });
  if (count !== serviceIds.length) throw new Error("Некоректний список послуг");
}

export async function createEmployeeAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("employee.manage");
    const input = parseEmployeeForm(formData);
    await assertServicesInOrg(input.serviceIds, ctx.organization.id);

    const employee = await prisma.employee.create({
      data: {
        organizationId: ctx.organization.id,
        name: input.name,
        position: input.position ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        color: input.color,
        bio: input.bio ?? null,
        isActive: input.isActive,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        services: { create: input.serviceIds.map((serviceId) => ({ serviceId })) },
      },
    });

    await prisma.employeeSchedule.createMany({ data: defaultSchedule(employee.id) });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "employee.create",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/employees");
    return ok({ id: employee.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("employee.manage");
    const input = parseEmployeeForm(formData);
    await assertServicesInOrg(input.serviceIds, ctx.organization.id);

    const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
    assertTenant(existing, ctx.organization.id);

    await prisma.$transaction([
      prisma.employeeService.deleteMany({ where: { employeeId } }),
      prisma.employee.update({
        where: { id: employeeId },
        data: {
          name: input.name,
          position: input.position ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          color: input.color,
          bio: input.bio ?? null,
          isActive: input.isActive,
          acceptsOnlineBooking: input.acceptsOnlineBooking,
          services: { create: input.serviceIds.map((serviceId) => ({ serviceId })) },
        },
      }),
    ]);

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "employee.update",
      entityType: "employee",
      entityId: employeeId,
    });
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    return ok({ id: employeeId });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteEmployeeAction(employeeId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("employee.manage");
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
    assertTenant(existing, ctx.organization.id);

    const upcoming = await prisma.appointment.count({
      where: { employeeId, startAt: { gte: new Date() }, status: { notIn: ["CANCELLED"] } },
    });
    if (upcoming > 0) {
      return fail(
        `У співробітника ${upcoming} майбутніх записів. Спочатку перенесіть їх або деактивуйте профіль.`,
      );
    }

    const hasHistory = await prisma.appointment.count({ where: { employeeId } });
    if (hasHistory > 0) {
      await prisma.employee.update({ where: { id: employeeId }, data: { isActive: false } });
      revalidatePath("/employees");
      return fail("Співробітника переведено в неактивні — історія записів зберігається.");
    }

    await prisma.employee.delete({ where: { id: employeeId } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "employee.delete",
      entityType: "employee",
      entityId: employeeId,
    });
    revalidatePath("/employees");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateScheduleAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requireAuth();
    const employeeId = String(formData.get("employeeId") ?? "");

    // Співробітник може редагувати лише власний графік.
    const canManageAll = ctx.permissions.has("schedule.manage");
    const isOwnSchedule =
      ctx.permissions.has("schedule.manage_own") && ctx.membership.employeeId === employeeId;
    if (!canManageAll && !isOwnSchedule) return fail("У вас недостатньо прав для цієї дії");

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    assertTenant(employee, ctx.organization.id);

    const days = Array.from({ length: 7 }, (_, weekday) => {
      const isDayOff = formData.get(`day-${weekday}-off`) === "on";
      const breakStart = formData.get(`day-${weekday}-breakStart`);
      const breakEnd = formData.get(`day-${weekday}-breakEnd`);
      return {
        weekday,
        isDayOff,
        startMinute: Number(formData.get(`day-${weekday}-start`) ?? 540),
        endMinute: Number(formData.get(`day-${weekday}-end`) ?? 1080),
        breakStart: breakStart ? Number(breakStart) : null,
        breakEnd: breakEnd ? Number(breakEnd) : null,
      };
    });

    const input = scheduleSchema.parse({ employeeId, days });

    for (const day of input.days) {
      if (!day.isDayOff && day.endMinute <= day.startMinute) {
        return fail("Час завершення має бути пізніше за час початку");
      }
    }

    await prisma.$transaction(
      input.days.map((day) =>
        prisma.employeeSchedule.upsert({
          where: { employeeId_weekday: { employeeId, weekday: day.weekday } },
          create: { employeeId, ...day },
          update: day,
        }),
      ),
    );

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/calendar");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function addScheduleExceptionAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requireAuth();
    const employeeId = String(formData.get("employeeId") ?? "");
    const canManageAll = ctx.permissions.has("schedule.manage");
    const isOwn =
      ctx.permissions.has("schedule.manage_own") && ctx.membership.employeeId === employeeId;
    if (!canManageAll && !isOwn) return fail("У вас недостатньо прав для цієї дії");

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    assertTenant(employee, ctx.organization.id);

    const input = scheduleExceptionSchema.parse({
      employeeId,
      date: formData.get("date"),
      endDate: formData.get("endDate"),
      type: formData.get("type") || "DAY_OFF",
      startMinute: formData.get("startMinute") || undefined,
      endMinute: formData.get("endMinute") || undefined,
      note: formData.get("note"),
    });

    await prisma.scheduleException.create({
      data: {
        employeeId,
        date: new Date(input.date),
        endDate: input.endDate ? new Date(input.endDate) : null,
        type: input.type,
        startMinute: input.startMinute ?? null,
        endMinute: input.endMinute ?? null,
        note: input.note ?? null,
      },
    });

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/calendar");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteScheduleExceptionAction(id: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requireAuth();
    const exception = await prisma.scheduleException.findUnique({
      where: { id },
      include: { employee: { select: { id: true, organizationId: true } } },
    });
    if (!exception) return fail("Запис не знайдено");
    assertTenant(exception.employee, ctx.organization.id);

    const canManageAll = ctx.permissions.has("schedule.manage");
    const isOwn =
      ctx.permissions.has("schedule.manage_own") &&
      ctx.membership.employeeId === exception.employeeId;
    if (!canManageAll && !isOwn) return fail("У вас недостатньо прав для цієї дії");

    await prisma.scheduleException.delete({ where: { id } });
    revalidatePath(`/employees/${exception.employeeId}`);
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

// ── Команда / доступи ────────────────────────────────────────────────────────

export async function inviteMemberAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("team.manage");
    const input = inviteSchema.parse({
      email: formData.get("email"),
      name: formData.get("name"),
      role: formData.get("role") || "EMPLOYEE",
      employeeId: formData.get("employeeId"),
      password: formData.get("password"),
    });

    if (input.employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
      assertTenant(employee, ctx.organization.id);
      const taken = await prisma.membership.findUnique({
        where: { employeeId: input.employeeId },
      });
      if (taken) return fail("До цього співробітника вже прив'язано користувача");
    }

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: ctx.organization.id,
          },
        },
      });
      if (existingMembership) return fail("Цей користувач вже є в команді");
    }

    const passwordHash = existingUser ? null : await hashPassword(input.password);

    // Створення користувача й членства — в одній транзакції: інакше збій на
    // другому кроці лишив би «осиротілий» акаунт без доступу до жодної організації.
    const user = await prisma.$transaction(async (tx) => {
      const account =
        existingUser ??
        (await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash: passwordHash! },
        }));

      await tx.membership.create({
        data: {
          userId: account.id,
          organizationId: ctx.organization.id,
          role: input.role,
          employeeId: input.employeeId ?? null,
          status: "ACTIVE",
        },
      });

      return account;
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "team.invite",
      entityType: "user",
      entityId: user.id,
      meta: { role: input.role },
    });
    revalidatePath("/settings/team");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateMemberRoleAction(
  membershipId: string,
  role: string,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("team.manage");
    const input = memberRoleSchema.parse({ membershipId, role });

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.organizationId !== ctx.organization.id) {
      return fail("Учасника не знайдено");
    }

    // Власника може призначити лише власник, і останній власник має лишитися.
    if (membership.role === "OWNER" && input.role !== "OWNER") {
      const owners = await prisma.membership.count({
        where: { organizationId: ctx.organization.id, role: "OWNER", status: "ACTIVE" },
      });
      if (owners <= 1) return fail("В організації має лишитися хоча б один власник");
    }
    if (input.role === "OWNER" && ctx.membership.role !== "OWNER") {
      return fail("Призначити власника може лише власник");
    }

    await prisma.membership.update({ where: { id: membershipId }, data: { role: input.role } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "team.role_change",
      entityType: "membership",
      entityId: membershipId,
      meta: { role: input.role },
    });
    revalidatePath("/settings/team");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setPermissionOverrideAction(
  membershipId: string,
  permission: string,
  allowed: boolean | null,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("team.manage");
    if (!PERMISSIONS.includes(permission as Permission)) return fail("Невідоме право");

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.organizationId !== ctx.organization.id) {
      return fail("Учасника не знайдено");
    }
    if (membership.role === "OWNER") return fail("Права власника не обмежуються");

    if (allowed === null) {
      await prisma.permissionOverride.deleteMany({ where: { membershipId, permission } });
    } else {
      await prisma.permissionOverride.upsert({
        where: { membershipId_permission: { membershipId, permission } },
        create: { membershipId, permission, allowed },
        update: { allowed },
      });
    }
    revalidatePath("/settings/team");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeMemberAction(membershipId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("team.manage");
    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.organizationId !== ctx.organization.id) {
      return fail("Учасника не знайдено");
    }
    if (membership.id === ctx.membership.id) return fail("Не можна видалити самого себе");
    if (membership.role === "OWNER") {
      const owners = await prisma.membership.count({
        where: { organizationId: ctx.organization.id, role: "OWNER", status: "ACTIVE" },
      });
      if (owners <= 1) return fail("В організації має лишитися хоча б один власник");
    }

    await prisma.membership.delete({ where: { id: membershipId } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "team.remove",
      entityType: "membership",
      entityId: membershipId,
    });
    revalidatePath("/settings/team");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

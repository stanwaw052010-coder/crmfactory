"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { assertTenant } from "@/lib/db/tenant";
import { clientNoteSchema, clientSchema } from "@/lib/validation";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

function parseClientForm(formData: FormData) {
  return clientSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    status: formData.get("status") || "NEW",
    source: formData.get("source"),
    birthday: formData.get("birthday"),
    address: formData.get("address"),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });
}

export async function createClientAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("client.create");
    const input = parseClientForm(formData);

    if (input.phone) {
      const duplicate = await prisma.client.findFirst({
        where: { organizationId: ctx.organization.id, phone: input.phone },
        select: { id: true, firstName: true, lastName: true },
      });
      if (duplicate) {
        return fail(
          `Клієнт із таким номером вже є: ${[duplicate.firstName, duplicate.lastName].filter(Boolean).join(" ")}`,
          { phone: "Номер уже використовується" },
        );
      }
    }

    const client = await prisma.client.create({
      data: {
        organizationId: ctx.organization.id,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        status: input.status,
        source: input.source ?? null,
        birthday: input.birthday ? new Date(input.birthday) : null,
        address: input.address ?? null,
        tags: input.tags,
        marketingOptIn: input.marketingOptIn,
      },
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "client.create",
      entityType: "client",
      entityId: client.id,
    });
    await notify({
      organizationId: ctx.organization.id,
      type: "CLIENT_CREATED",
      title: "Новий клієнт",
      body: `${client.firstName} ${client.lastName ?? ""}`.trim(),
      entityType: "client",
      entityId: client.id,
    });

    revalidatePath("/clients");
    return ok({ id: client.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateClientAction(
  clientId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("client.update");
    const input = parseClientForm(formData);

    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    assertTenant(existing, ctx.organization.id);

    await prisma.client.update({
      where: { id: clientId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        status: input.status,
        source: input.source ?? null,
        birthday: input.birthday ? new Date(input.birthday) : null,
        address: input.address ?? null,
        tags: input.tags,
        marketingOptIn: input.marketingOptIn,
      },
    });

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "client.update",
      entityType: "client",
      entityId: clientId,
    });

    revalidatePath("/clients");
    revalidatePath(`/clients/${clientId}`);
    return ok({ id: clientId });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteClientAction(clientId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("client.delete");
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    assertTenant(existing, ctx.organization.id);

    await prisma.client.delete({ where: { id: clientId } });
    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "client.delete",
      entityType: "client",
      entityId: clientId,
    });
    revalidatePath("/clients");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function addClientNoteAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("client.update");
    const input = clientNoteSchema.parse({
      clientId: formData.get("clientId"),
      body: formData.get("body"),
      pinned: formData.get("pinned") === "on",
    });

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    assertTenant(client, ctx.organization.id);

    await prisma.clientNote.create({
      data: {
        clientId: input.clientId,
        authorId: ctx.user.id,
        body: input.body,
        pinned: input.pinned,
      },
    });

    revalidatePath(`/clients/${input.clientId}`);
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteClientNoteAction(noteId: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("client.update");
    const note = await prisma.clientNote.findUnique({
      where: { id: noteId },
      include: { client: { select: { id: true, organizationId: true } } },
    });
    if (!note) return fail("Нотатку не знайдено");
    assertTenant(note.client, ctx.organization.id);

    await prisma.clientNote.delete({ where: { id: noteId } });
    revalidatePath(`/clients/${note.client.id}`);
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** Швидке створення клієнта прямо з форми запису. */
export async function quickCreateClientAction(input: {
  firstName: string;
  phone?: string;
}): Promise<ActionResult<{ id: string; label: string }>> {
  try {
    const ctx = await requirePermission("client.create");
    const parsed = clientSchema.parse({ firstName: input.firstName, phone: input.phone, tags: [] });

    const client = await prisma.client.create({
      data: {
        organizationId: ctx.organization.id,
        firstName: parsed.firstName,
        phone: parsed.phone ?? null,
        status: "NEW",
      },
    });
    revalidatePath("/clients");
    return ok({ id: client.id, label: client.firstName });
  } catch (error) {
    return toActionError(error);
  }
}

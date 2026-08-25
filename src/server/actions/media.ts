"use server";

import { revalidatePath } from "next/cache";
import type { MediaKind } from "@prisma/client";
import { requirePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { GALLERY_LIMIT, deleteMedia, storeImage } from "@/server/media";

const KINDS: MediaKind[] = ["GALLERY", "LOGO", "COVER", "EMPLOYEE"];

function parseKind(value: FormDataEntryValue | null): MediaKind | null {
  const raw = typeof value === "string" ? value : "";
  return (KINDS as string[]).includes(raw) ? (raw as MediaKind) : null;
}

/**
 * Завантаження зображення.
 *
 * Форма надсилає вже стиснений у браузері файл (див. `resizeImage`), тож
 * сюди приходять ~200 КБ, а не оригінал із камери на 6 МБ. Розміри
 * приймаються як підказка для верстки — на них нічого не тримається,
 * і брехня в них нічого не ламає.
 */
export async function uploadMediaAction(
  _prev: ActionResult<{ id: string; url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string }>> {
  try {
    const ctx = await requirePermission("settings.manage");

    const kind = parseKind(formData.get("kind"));
    if (!kind) return fail("Невідомий тип зображення");

    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Файл не надіслано");

    // Ліміт галереї тримається на сервері, а не кількістю слотів у формі:
    // інакше його обходить будь-який повторний запит.
    if (kind === "GALLERY") {
      const existing = await prisma.mediaAsset.count({
        where: { organizationId: ctx.organization.id, kind: "GALLERY" },
      });
      if (existing >= GALLERY_LIMIT) {
        return fail(`Більше ${GALLERY_LIMIT} фото в галереї не можна`);
      }
    }

    const width = Number(formData.get("width")) || 0;
    const height = Number(formData.get("height")) || 0;

    const result = await storeImage({
      organizationId: ctx.organization.id,
      kind,
      file,
      width,
      height,
      sortOrder: Number(formData.get("sortOrder")) || 0,
    });

    if (!result.ok) return fail(result.error);

    // Перевірка вище — «порахували, потім вставили», і між цими двома
    // кроками паралельний запит устигає вставити своє фото: обидва бачать
    // 4 і обидва пишуть, виходить 6. Тому рахуємо ще раз ПІСЛЯ вставки й
    // прибираємо власний запис, якщо перебрали. Програє той, хто прийшов
    // останнім, — а ліміт лишається правдою.
    if (kind === "GALLERY") {
      const total = await prisma.mediaAsset.count({
        where: { organizationId: ctx.organization.id, kind: "GALLERY" },
      });
      if (total > GALLERY_LIMIT) {
        await deleteMedia(ctx.organization.id, result.id);
        return fail(`Більше ${GALLERY_LIMIT} фото в галереї не можна`);
      }
    }

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "media.upload",
      entityType: "media",
      entityId: result.id,
      meta: { kind },
    });

    revalidatePath("/settings/booking");
    revalidatePath("/onboarding");
    return ok({ id: result.id, url: result.url });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteMediaAction(id: string): Promise<ActionResult<null>> {
  try {
    const ctx = await requirePermission("settings.manage");

    const removed = await deleteMedia(ctx.organization.id, id);
    if (!removed) return fail("Фото не знайдено");

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "media.delete",
      entityType: "media",
      entityId: id,
    });

    revalidatePath("/settings/booking");
    revalidatePath("/onboarding");
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

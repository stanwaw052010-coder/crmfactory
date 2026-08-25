import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { MediaKind } from "@prisma/client";

/**
 * Приймання та зберігання зображень.
 *
 * Єдине місце, що знає, ДЕ лежать байти. Зараз — у Postgres; перехід на
 * Vercel Blob чи S3 змінить лише цей файл, бо назовні віддається шлях
 * `/api/media/<id>`, а не адреса сховища.
 */

/** Дозволені формати. SVG свідомо немає: це XML, а отже вектор для XSS. */
const ALLOWED = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF" + перевірка "WEBP" нижче
} as const;

export type AllowedMime = keyof typeof ALLOWED;

/** 3 МБ — стеля вже ПІСЛЯ стиснення в браузері. Типове фото виходить ~200 КБ. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/** Скільки фото галереї може мати салон. */
export const GALLERY_LIMIT = 5;

/**
 * Перевірка, що файл — справді зображення заявленого типу.
 *
 * Заголовку `Content-Type` вірити не можна: його ставить клієнт. Тому
 * дивимось на сигнатуру в перших байтах. Без цього під виглядом
 * картинки можна покласти HTML і отримати XSS на власному домені —
 * файли ж роздаються з нашого origin.
 */
export function sniffImage(bytes: Uint8Array): AllowedMime | null {
  for (const [mime, signatures] of Object.entries(ALLOWED) as [
    AllowedMime,
    readonly (readonly number[])[],
  ][]) {
    for (const signature of signatures) {
      if (signature.every((byte, index) => bytes[index] === byte)) {
        // У WebP після "RIFF" ідуть 4 байти розміру, потім "WEBP".
        if (mime === "image/webp") {
          const tag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
          if (tag !== "WEBP") continue;
        }
        return mime;
      }
    }
  }
  return null;
}

export type StoreResult =
  | { ok: true; id: string; url: string }
  | { ok: false; error: string };

export async function storeImage(params: {
  organizationId: string;
  kind: MediaKind;
  file: File;
  width: number;
  height: number;
  sortOrder?: number;
}): Promise<StoreResult> {
  const { organizationId, kind, file } = params;

  if (file.size === 0) return { ok: false, error: "Файл порожній" };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Файл завеликий — максимум 3 МБ" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImage(bytes);
  if (!mimeType) {
    return {
      ok: false,
      error: "Підтримуються лише JPG, PNG і WebP. Спробуйте інший файл.",
    };
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      organizationId,
      kind,
      data: Buffer.from(bytes),
      mimeType,
      width: Math.max(1, Math.round(params.width)),
      height: Math.max(1, Math.round(params.height)),
      sizeBytes: bytes.byteLength,
      sortOrder: params.sortOrder ?? 0,
    },
    select: { id: true },
  });

  return { ok: true, id: asset.id, url: mediaUrl(asset.id) };
}

/** Публічний шлях до файла. Саме він лягає в logoUrl / avatarUrl. */
export function mediaUrl(id: string): string {
  return `/api/media/${id}`;
}

/** Список без байтів — те, що можна безпечно тягнути на кожен рендер. */
export async function listMedia(organizationId: string, kind: MediaKind) {
  const items = await prisma.mediaAsset.findMany({
    where: { organizationId, kind },
    select: { id: true, caption: true, width: true, height: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return items.map((item) => ({ ...item, url: mediaUrl(item.id) }));
}

/** Видалення в межах свого tenant — id з чужої організації не спрацює. */
export async function deleteMedia(organizationId: string, id: string): Promise<boolean> {
  const result = await prisma.mediaAsset.deleteMany({ where: { id, organizationId } });
  return result.count > 0;
}

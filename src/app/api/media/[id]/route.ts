import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Роздача зображення.
 *
 * Файл публічний навмисно: його показують на сторінці онлайн-запису, яку
 * бачать усі. Ідентифікатор — cuid, тож перебрати чужі фото не вийде.
 *
 * Два заголовки тут не косметичні:
 *
 * • `X-Content-Type-Options: nosniff` — забороняє браузеру «здогадуватися»
 *   про тип усупереч Content-Type. Разом із перевіркою сигнатури під час
 *   завантаження це закриває підміну картинки на HTML.
 * • `Cache-Control: immutable` — вміст під конкретним id ніколи не
 *   змінюється (нове фото = новий запис), тож браузер може не питати вдруге.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length > 40) {
    return new NextResponse("Not found", { status: 404 });
  }

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, sizeBytes: true },
  });

  if (!asset) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.sizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

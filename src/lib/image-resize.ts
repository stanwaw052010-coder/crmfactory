/**
 * Стиснення зображення в браузері перед відправкою.
 *
 * Фото з телефону — це 4–8 МБ і 4000 пікселів по довгій стороні. Для
 * картки салону вистачає 1600, і різниця у вазі — тридцятикратна. Робити
 * це на клієнті вигідніше з усіх боків: не витрачається трафік власниці
 * салону, завантаження йде секунду, а не хвилину, і серверу не потрібен
 * `sharp` із нативними бінарниками.
 *
 * Результат завжди JPEG: canvas однаково перемальовує пікселі, а jpeg
 * дає найменший розмір для фотографій і не тягне альфа-канал.
 */

export type ResizedImage = {
  file: File;
  width: number;
  height: number;
  /** У скільки разів зменшився файл — показуємо в інтерфейсі. */
  ratio: number;
};

export const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export async function resizeImage(
  input: File,
  maxDimension = MAX_DIMENSION,
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(input);

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не дав доступ до canvas");

    // Білий фон: у PNG із прозорістю інакше вийде чорний прямокутник,
    // бо jpeg не має альфа-каналу.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) throw new Error("Не вдалося стиснути зображення");

    const name = input.name.replace(/\.[^.]+$/, "") || "photo";
    const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });

    return {
      file,
      width,
      height,
      ratio: input.size > 0 ? input.size / blob.size : 1,
    };
  } finally {
    bitmap.close();
  }
}

/** Людський розмір файла для підписів. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

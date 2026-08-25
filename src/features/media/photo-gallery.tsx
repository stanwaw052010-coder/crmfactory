"use client";

import * as React from "react";
import { AlertCircle, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resizeImage } from "@/lib/image-resize";
import { deleteMediaAction, uploadMediaAction } from "@/server/actions/media";

export type GalleryPhoto = { id: string; url: string };

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Галерея салону: фіксована кількість слотів, які заповнюються по одному.
 *
 * Порожні слоти показані навмисно. Зона «перетягніть файли» не підказує,
 * СКІЛЬКИ фото має сенс додати; п'ять рамок кажуть це без жодного тексту —
 * і поки вони порожні, сторінка виглядає незавершеною, що спонукає краще
 * за будь-яку інструкцію.
 */
export function PhotoGallery({
  photos: initialPhotos,
  slots = 5,
  kind = "GALLERY",
  disabled,
  onChange,
}: {
  photos: GalleryPhoto[];
  slots?: number;
  kind?: "GALLERY" | "LOGO" | "COVER" | "EMPLOYEE";
  disabled?: boolean;
  onChange?: (photos: GalleryPhoto[]) => void;
}) {
  const [photos, setPhotos] = React.useState<GalleryPhoto[]>(initialPhotos);
  const [busySlot, setBusySlot] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const update = (next: GalleryPhoto[]) => {
    setPhotos(next);
    onChange?.(next);
  };

  async function handleFile(file: File, slotIndex: number) {
    setError(null);
    setBusySlot(slotIndex);

    try {
      // Стискаємо ДО відправки: з телефону приходить 6 МБ, назад іде ~200 КБ.
      const resized = await resizeImage(file);

      const formData = new FormData();
      formData.append("file", resized.file);
      formData.append("kind", kind);
      formData.append("width", String(resized.width));
      formData.append("height", String(resized.height));
      formData.append("sortOrder", String(slotIndex));

      const result = await uploadMediaAction(null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      update([...photos, { id: result.data.id, url: result.data.url }]);
    } catch {
      setError("Не вдалося обробити файл. Спробуйте інше фото.");
    } finally {
      setBusySlot(null);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const previous = photos;
    // Прибираємо одразу — чекати на сервер тут нема сенсу,
    // а у разі відмови повертаємо як було.
    update(photos.filter((photo) => photo.id !== id));

    const result = await deleteMediaAction(id);
    if (!result.ok) {
      update(previous);
      setError(result.error);
    }
  }

  const cells = Array.from({ length: slots }, (_, index) => photos[index] ?? null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((photo, index) => (
          <PhotoSlot
            key={photo?.id ?? `empty-${index}`}
            photo={photo}
            index={index}
            busy={busySlot === index}
            disabled={disabled || busySlot !== null}
            onPick={(file) => handleFile(file, index)}
            onDelete={photo ? () => handleDelete(photo.id) : undefined}
          />
        ))}
      </div>

      {error && (
        <p className="animate-fade-up flex items-start gap-2 text-[12.5px] text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-[12px] leading-relaxed text-[var(--fg-subtle)]">
        JPG, PNG або WebP. Великі фото зменшуються прямо в браузері — завантажувати
        можна просто з телефону, нічого стискати вручну не треба.
      </p>
    </div>
  );
}

function PhotoSlot({
  photo,
  index,
  busy,
  disabled,
  onPick,
  onDelete,
}: {
  photo: GalleryPhoto | null;
  index: number;
  busy: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
  onDelete?: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  if (photo) {
    return (
      <div className="group animate-scale-in relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
        {/* Звичайний <img>: файл віддає наш власний роут, оптимізатор Next
            тут нічого не додасть, лише зайвий прохід. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={`Фото салону ${index + 1}`}
          className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-105"
        />
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Видалити фото"
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-[var(--danger)] focus-visible:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed",
        "transition-all duration-200 ease-[var(--ease-out-expo)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        dragOver
          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
          : "border-[var(--border-strong)] bg-[var(--surface-2)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]",
      )}
    >
      {busy ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          <span className="text-[11.5px] text-[var(--fg-muted)]">Завантаження…</span>
        </>
      ) : (
        <>
          <ImagePlus className="h-5 w-5 text-[var(--fg-subtle)]" />
          <span className="text-[11.5px] text-[var(--fg-subtle)]">Фото {index + 1}</span>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          // Скидаємо значення, щоб той самий файл можна було обрати вдруге.
          event.target.value = "";
        }}
      />
    </button>
  );
}

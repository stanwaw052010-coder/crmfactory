"use client";

import * as React from "react";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { resizeImage } from "@/lib/image-resize";
import { uploadMediaAction } from "@/server/actions/media";

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Одне кругле фото — для майстра.
 *
 * Значення віддається назовні через приховане поле форми, тому компонент
 * вставляється у вже наявну форму без перебудови: фото завантажується
 * одразу, а посилання їде разом із рештою полів при збереженні.
 *
 * Аватар стискається сильніше за галерею: 512 пікселів вистачає навіть
 * для retina-екрана, а важить таке фото близько 40 КБ.
 */
export function AvatarUpload({
  name,
  defaultUrl,
  label = "Фото",
  disabled,
}: {
  /** Ім'я прихованого поля, куди ляже посилання. */
  name: string;
  defaultUrl?: string | null;
  label?: string;
  disabled?: boolean;
}) {
  const [url, setUrl] = React.useState<string | null>(defaultUrl ?? null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const resized = await resizeImage(file, 512);

      const formData = new FormData();
      formData.append("file", resized.file);
      formData.append("kind", "EMPLOYEE");
      formData.append("width", String(resized.width));
      formData.append("height", String(resized.height));

      const result = await uploadMediaAction(null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.data.url);
    } catch {
      setError("Не вдалося обробити фото");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium text-[var(--fg)]">{label}</p>

      <div className="flex items-center gap-3">
        <input type="hidden" name={name} value={url ?? ""} />

        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed",
            "flex items-center justify-center transition-all duration-200 ease-[var(--ease-out-expo)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            url
              ? "border-transparent"
              : "border-[var(--border-strong)] bg-[var(--surface-2)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          ) : url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </>
          ) : (
            <Camera className="h-5 w-5 text-[var(--fg-subtle)]" />
          )}
        </button>

        <div className="min-w-0 text-[12.5px] text-[var(--fg-muted)]">
          {url ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setUrl(null)}
              className="inline-flex items-center gap-1 text-[var(--danger)] hover:underline"
            >
              <X className="h-3 w-3" />
              Прибрати фото
            </button>
          ) : (
            <p className="leading-relaxed">
              Клієнти бачать фото при виборі майстра.
              <br />
              JPG, PNG або WebP.
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Глобальний екран помилки. Користувач бачить зрозуміле пояснення
 * і кнопку «Спробувати ще раз» — жодних stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-[20px] font-semibold tracking-tight text-[var(--fg)]">
        Щось пішло не так
      </h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-balance text-[var(--fg-muted)]">
        Ми не змогли завантажити цю сторінку. Спробуйте ще раз — якщо проблема повториться,
        напишіть нам.
      </p>
      {error.digest && (
        <p className="mt-3 text-[11.5px] text-[var(--fg-subtle)]">Код помилки: {error.digest}</p>
      )}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Спробувати ще раз
      </Button>
    </div>
  );
}

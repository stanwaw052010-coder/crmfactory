"use client";

import { cn } from "@/lib/utils";

/**
 * Рейтинг за величиною. Одна метрика — один відтінок; ранг несе довжина
 * смуги, а не колір. Значення підписані прямо, тож вісь не потрібна.
 */
export function HorizontalBars({
  items,
  formatValue,
  emptyLabel = "Немає даних за період",
  className,
}: {
  items: { id: string; label: string; value: number; sublabel?: string }[];
  formatValue?: (value: number) => string;
  emptyLabel?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={cn("py-8 text-center text-[13px] text-[var(--fg-muted)]", className)}>
        {emptyLabel}
      </p>
    );
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <div className="mb-1.5 flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--fg)]">
              {item.label}
            </span>
            {item.sublabel && (
              <span className="text-[12px] text-[var(--fg-subtle)]">{item.sublabel}</span>
            )}
            <span className="text-[13px] font-semibold text-[var(--fg)] tabular-nums">
              {formatValue ? formatValue(item.value) : item.value}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import type { TooltipProps } from "recharts";

/**
 * Спільна підказка для всіх графіків.
 * Текст — завжди в кольорах тексту; колір серії несе лише маркер.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: TooltipProps<number, string> & {
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-pop)]">
      {label != null && (
        <p className="mb-1.5 text-[11.5px] font-medium text-[var(--fg-muted)]">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: entry.color }}
              aria-hidden
            />
            <span className="text-[12.5px] text-[var(--fg-muted)]">{entry.name}</span>
            <span className="ml-auto text-[13px] font-semibold text-[var(--fg)] tabular-nums">
              {formatter
                ? formatter(Number(entry.value), String(entry.name))
                : String(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

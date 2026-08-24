import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "brand",
  invertDelta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  /** Для метрик, де зростання — погано (скасування, no-show). */
  invertDelta?: boolean;
  className?: string;
}) {
  const toneClass = {
    brand: "bg-[var(--primary-soft)] text-[var(--primary)]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  }[tone];

  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  const good = invertDelta ? negative : positive;
  const bad = invertDelta ? positive : negative;
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        "card group relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-[var(--fg-muted)]">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px]", toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-[var(--fg)] tabular-nums">
        {value}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold",
              good && "bg-[var(--success-soft)] text-[var(--success)]",
              bad && "bg-[var(--danger-soft)] text-[var(--danger)]",
              delta === 0 && "bg-[var(--surface-hover)] text-[var(--fg-muted)]",
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="text-[12px] text-[var(--fg-subtle)]">{hint}</span>}
      </div>
    </div>
  );
}

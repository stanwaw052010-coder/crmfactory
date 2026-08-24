import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  brand: { soft: "bg-[var(--primary-soft)] text-[var(--primary)]", accent: "var(--primary)" },
  success: { soft: "bg-[var(--success-soft)] text-[var(--success)]", accent: "var(--success)" },
  warning: { soft: "bg-[var(--warning-soft)] text-[var(--warning)]", accent: "var(--warning)" },
  danger: { soft: "bg-[var(--danger-soft)] text-[var(--danger)]", accent: "var(--danger)" },
  info: { soft: "bg-[var(--info-soft)] text-[var(--info)]", accent: "var(--info)" },
} as const;

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
  tone?: keyof typeof TONES;
  /** Для метрик, де зростання — погано (скасування, no-show). */
  invertDelta?: boolean;
  className?: string;
}) {
  const { soft, accent } = TONES[tone];

  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  const good = invertDelta ? negative : positive;
  const bad = invertDelta ? positive : negative;
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  return (
    <div className={cn("card card-interactive group relative overflow-hidden p-5", className)}>
      {/* Кольорова смуга зверху: згорнута в точку, розкривається на всю
          ширину при наведенні — картка «вмикається», а не просто світиться. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      {/* Ледь помітний градієнтний кут у тон метрики — глибина без шуму. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-[0.13]"
        style={{ background: accent }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-[var(--fg-muted)]">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[10px] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-110",
              soft,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="relative mt-3 text-[28px] leading-none font-semibold tracking-[-0.02em] text-[var(--fg)] tabular-nums">
        {value}
      </p>

      <div className="relative mt-3 flex items-center gap-2">
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums",
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

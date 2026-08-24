import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Порожній стан ніколи не буває просто порожнім екраном:
 * іконка, пояснення що це дасть бізнесу, і одна очевидна дія.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  className,
  compact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-[var(--primary)]/10 blur-2xl" />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--fg)]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-balance text-[var(--fg-muted)]">
          {description}
        </p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

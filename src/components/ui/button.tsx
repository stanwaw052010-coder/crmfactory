"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "soft" | "success";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  // `sheen` — світловий відблиск, що пробігає зліва направо на hover.
  // Тільки на заповнених кнопках: на прозорих йому нема по чому бігти.
  primary:
    "sheen bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-brand)] " +
    "hover:brightness-110 hover:shadow-[0_10px_28px_-8px_rgb(37_99_235/0.62)] active:brightness-95",
  secondary:
    "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] shadow-[var(--shadow-soft)] " +
    "hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
  outline:
    "border border-[var(--border-strong)] text-[var(--fg)] hover:bg-[var(--surface-hover)]",
  ghost: "text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
  soft: "bg-[var(--primary-soft)] text-[var(--primary)] hover:brightness-95 dark:hover:brightness-125",
  danger: "sheen bg-[var(--danger)] text-white hover:brightness-110",
  success: "sheen bg-[var(--success)] text-white hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-[14px]",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-[10px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-[background,color,box-shadow,transform,filter,border-color] duration-150",
        "ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-50",
        // Натиснення відчутне на дотик: кнопка «просідає» і одразу вертається.
        "active:scale-[0.97] active:transition-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
      {children}
    </button>
  );
});

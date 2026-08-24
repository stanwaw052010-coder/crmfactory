import { cn } from "@/lib/utils";

/** Знак бренду: «фабрика» з блоків, що збираються в одну систему. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
        "bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-electric)]",
        "shadow-[0_4px_14px_-4px_rgb(37_99_235_/_0.7)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
        <path d="M4 19V10l5 3V10l5 3V6l6 4v9z" fill="white" fillOpacity="0.95" />
        <rect x="4" y="19" width="16" height="1.6" rx="0.8" fill="white" fillOpacity="0.6" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  size = "md",
  showMark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showMark?: boolean;
}) {
  const text = {
    sm: "text-[15px]",
    md: "text-[17px]",
    lg: "text-2xl",
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showMark && <LogoMark className={size === "lg" ? "h-10 w-10 rounded-xl" : undefined} />}
      <span className={cn("font-semibold tracking-tight text-[var(--fg)]", text)}>
        crm<span className="text-[var(--primary)]">.</span>factory
      </span>
    </span>
  );
}

export function SystemStatus({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] text-[var(--fg-subtle)]", className)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-[var(--success)]" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
      </span>
      System operational
    </span>
  );
}

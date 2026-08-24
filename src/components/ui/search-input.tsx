"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Пошук…",
  className,
  loading,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  loading?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pr-9 pl-9 text-sm",
          "placeholder:text-[var(--fg-subtle)] transition-colors duration-150",
          "hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:outline-none",
          "focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_14%,transparent)]",
        )}
      />
      {loading ? (
        <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--fg-subtle)]" />
      ) : value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистити"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

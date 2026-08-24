"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-[var(--border)] no-scrollbar", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative shrink-0 px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-150",
              active ? "text-[var(--primary)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-semibold",
                    active
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "bg-[var(--surface-hover)] text-[var(--fg-subtle)]",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {active && (
              <motion.span
                layoutId={`tab-underline-${id}`}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--primary)]"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = React.useId();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-[9px] font-medium transition-colors duration-150",
              size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13px]",
              active ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-[9px] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Легкий tooltip на CSS — без залежностей і без затримок рендеру. */
export function Tooltip({
  label,
  side = "right",
  children,
  className,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
  className?: string;
}) {
  const position = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
  }[side];

  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[80] rounded-lg bg-slate-900 px-2 py-1 text-[12px] font-medium whitespace-nowrap text-white",
          "opacity-0 shadow-lg transition-opacity duration-150 group-hover/tt:opacity-100",
          "dark:bg-slate-100 dark:text-slate-900",
          position,
        )}
      >
        {label}
      </span>
    </span>
  );
}

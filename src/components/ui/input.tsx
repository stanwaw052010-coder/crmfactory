"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--fg)] " +
  "placeholder:text-[var(--fg-subtle)] transition-colors duration-150 " +
  "hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:outline-none " +
  "focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_14%,transparent)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(base, "h-10 px-3", invalid && "border-[var(--danger)]", className)}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(base, "min-h-[88px] resize-y px-3 py-2.5", invalid && "border-[var(--danger)]", className)}
        {...props}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            base,
            "h-10 cursor-pointer appearance-none px-3 pr-9",
            invalid && "border-[var(--danger)]",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  },
);

export function Label({ className, children, hint, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-[13px] font-medium text-[var(--fg)]", className)} {...props}>
      {children}
      {hint && <span className="text-[12px] font-normal text-[var(--fg-subtle)]">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  name,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  name?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        checked ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked && "translate-x-5",
        )}
      />
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
    </button>
  );

  if (!label) return control;

  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--fg)]">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">{description}</p>}
      </div>
      {control}
    </div>
  );
}

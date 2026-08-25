"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { formatDateUk } from "@/lib/time";
import type { SlotSuggestion } from "@/server/actions/appointments";

/**
 * Підказки «найкращий час».
 *
 * Кожна пропозиція підписана причиною, чому саме вона. Без причини це
 * був би просто ще один список годин — а з нею видно, що система
 * рахувала щільність дня й історію клієнтки, і їй можна довіряти.
 */
export function SlotSuggestions({
  items,
  loading,
  onPick,
}: {
  items: SlotSuggestion[];
  loading: boolean;
  onPick: (suggestion: SlotSuggestion) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
        <Sparkles className="h-3.5 w-3.5" />
        Найкращий час
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </p>

      {loading && items.length === 0 ? (
        <div className="flex gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="skeleton h-[52px] w-[132px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="stagger flex flex-wrap gap-2">
          {items.map((suggestion) => (
            <button
              key={`${suggestion.employeeId}-${suggestion.dateKey}-${suggestion.time}`}
              type="button"
              onClick={() => onPick(suggestion)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-[var(--shadow-soft)]"
            >
              <span className="block text-[13.5px] font-semibold text-[var(--fg)] tabular-nums">
                {suggestion.time}
                <span className="ml-1.5 text-[12px] font-normal text-[var(--fg-muted)]">
                  {formatDateUk(new Date(`${suggestion.dateKey}T00:00:00`))}
                </span>
              </span>
              <span className="mt-0.5 block text-[11.5px] text-[var(--fg-muted)]">
                {suggestion.employeeName} · {suggestion.reason}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

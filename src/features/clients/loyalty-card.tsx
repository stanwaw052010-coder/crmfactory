"use client";

import * as React from "react";
import { Award, Clock3, Sparkles } from "lucide-react";
import { cn, pluralUk } from "@/lib/utils";
import {
  daysSince,
  lapsedLabel,
  loyaltyTier,
  nextLoyaltyStep,
  type LoyaltyTier,
} from "@/lib/loyalty";

const TONES: Record<LoyaltyTier["tone"], { bg: string; fg: string; bar: string }> = {
  muted: { bg: "var(--surface-hover)", fg: "var(--fg-muted)", bar: "var(--fg-subtle)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)", bar: "var(--info)" },
  brand: { bg: "var(--primary-soft)", fg: "var(--primary)", bar: "var(--primary)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)", bar: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)", bar: "var(--warning)" },
};

/** Компактний значок рівня — для таблиць і шапок. */
export function LoyaltyBadge({ visits, className }: { visits: number; className?: string }) {
  const tier = loyaltyTier(visits);
  const tone = TONES[tier.tone];

  return (
    <span
      title={tier.hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
        className,
      )}
      style={{ background: tone.bg, color: tone.fg }}
    >
      {tier.key === "vip" && <Award className="h-3 w-3" />}
      {tier.label}
    </span>
  );
}

/**
 * Картка лояльності в профілі клієнта.
 *
 * Показує три речі, яких раніше не було видно: на якому рівні клієнт,
 * скільки візитів до наступного, і чи не пора нагадати про себе. Останнє —
 * найцінніше: клієнт, який не приходив три місяці, зазвичай не образився,
 * про нього просто забули.
 */
export function LoyaltyCard({
  visits,
  lastVisitAt,
  now,
}: {
  visits: number;
  lastVisitAt: Date | null;
  /** Час сервера — щоб «3 місяці тому» не залежало від годинника браузера. */
  now: number;
}) {
  const tier = loyaltyTier(visits);
  const tone = TONES[tier.tone];
  const step = nextLoyaltyStep(visits);
  const gap = daysSince(lastVisitAt, new Date(now));
  const lapsed = lapsedLabel(gap);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 p-5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tone.bg, color: tone.fg }}
        >
          {tier.key === "vip" ? (
            <Award className="h-5 w-5" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[var(--fg)]">{tier.label}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            {tier.hint}
          </p>

          {step && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-[var(--fg-subtle)]">
                  Ще {step.remaining}{" "}
                  {pluralUk(step.remaining, "візит", "візити", "візитів")} до «{step.tier.label}»
                </span>
                <span className="font-medium tabular-nums text-[var(--fg-muted)]">
                  {visits} / {step.tier.minVisits}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <div
                  className="h-full rounded-full transition-transform duration-700 ease-[var(--ease-out-expo)]"
                  style={{
                    background: tone.bar,
                    transform: `scaleX(${step.progress})`,
                    transformOrigin: "left",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {lapsed && (
        <div className="flex items-start gap-2.5 border-t border-[var(--border)] bg-[var(--warning-soft)] px-5 py-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <p className="text-[12.5px] leading-relaxed text-[var(--warning)]">
            {lapsed}. Гарний привід написати й запропонувати зручний час.
          </p>
        </div>
      )}
    </div>
  );
}

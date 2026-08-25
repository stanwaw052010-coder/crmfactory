"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { cn } from "@/lib/utils";
import type { HealthBand, HealthMetric } from "@/lib/health";

const TONES = {
  success: { fg: "var(--success)", soft: "var(--success-soft)" },
  warning: { fg: "var(--warning)", soft: "var(--warning-soft)" },
  danger: { fg: "var(--danger)", soft: "var(--danger-soft)" },
} as const;

/** Колір смужки метрики — за самою оцінкою, а не за загальною. */
function metricTone(score: number | null) {
  if (score === null) return "var(--fg-subtle)";
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--warning)";
  return "var(--danger)";
}

export function BusinessHealth({
  score,
  band,
  metrics,
  windowDays,
}: {
  score: number | null;
  band: HealthBand | null;
  metrics: HealthMetric[];
  windowDays: number;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  // Порожня оцінка — це не «нуль здоров'я», а «ще нема з чого рахувати».
  if (score === null || band === null) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--fg-subtle)]">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-[var(--fg)]">Стан бізнесу</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">
              З&apos;явиться, щойно накопичиться історія записів і оплат.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const tone = TONES[band.tone];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <ScoreRing score={score} color={tone.fg} />

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[var(--fg)]">Стан бізнесу</p>
          <p className="mt-0.5 text-[13px] font-medium" style={{ color: tone.fg }}>
            {band.label}
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
            За останні {windowDays} днів проти попередніх {windowDays}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {metrics.map((metric) => {
          const open = openKey === metric.key;
          const color = metricTone(metric.score);

          return (
            <li key={metric.key}>
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : metric.key)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
              >
                <span className="w-[104px] shrink-0 text-[13px] font-medium text-[var(--fg)]">
                  {metric.label}
                </span>

                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <span
                    className="block h-full rounded-full transition-transform duration-700 ease-[var(--ease-out-expo)]"
                    style={{
                      background: color,
                      transform: `scaleX(${(metric.score ?? 0) / 100})`,
                      transformOrigin: "left",
                    }}
                  />
                </span>

                <span
                  className="w-11 shrink-0 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color }}
                >
                  {metric.score === null ? "—" : metric.score}
                </span>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform duration-200",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div className="animate-fade-up px-5 pb-4">
                  <p className="text-[13px] font-medium text-[var(--fg)]">
                    {metric.headline}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
                    {metric.detail}
                  </p>
                  {metric.action && (
                    <Link
                      href={metric.action.href}
                      className="mt-2.5 inline-flex text-[12.5px] font-medium text-[var(--primary)] hover:underline"
                    >
                      {metric.action.label} →
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Кільце прогресу. Дуга домальовується від нуля разом із числом. */
function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          style={{
            transition: "stroke-dashoffset 1s var(--ease-out-expo)",
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[17px] font-semibold tracking-tight text-[var(--fg)] tabular-nums">
        <AnimatedNumber value={score} duration={900} />
      </span>
    </div>
  );
}

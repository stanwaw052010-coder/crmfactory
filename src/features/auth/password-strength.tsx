"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ті самі правила, що й у `newPasswordSchema` — але з миттєвим фідбеком. */
const RULES = [
  { label: "Мінімум 8 символів", test: (v: string) => v.length >= 8 },
  { label: "Хоча б одна літера", test: (v: string) => /[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(v) },
  { label: "Хоча б одна цифра", test: (v: string) => /\d/.test(v) },
];

const TIERS = [
  { label: "Слабкий", color: "var(--danger)" },
  { label: "Непоганий", color: "var(--warning)" },
  { label: "Надійний", color: "var(--success)" },
];

export function PasswordStrength({ value }: { value: string }) {
  const passed = RULES.map((rule) => rule.test(value));
  const score = passed.filter(Boolean).length;
  const bonus = value.length >= 12 ? 1 : 0;
  const tier = TIERS[Math.min(TIERS.length - 1, Math.max(0, score + bonus - 1))];

  if (!value) return null;

  return (
    <div className="animate-fade-up space-y-2.5 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="flex-1 rounded-full transition-all duration-300"
              style={{
                background: index < score ? tier.color : "var(--border)",
                transform: index < score ? "scaleY(1)" : "scaleY(0.7)",
              }}
            />
          ))}
        </div>
        <span
          className="text-[11.5px] font-medium tabular-nums transition-colors duration-300"
          style={{ color: tier.color }}
        >
          {tier.label}
        </span>
      </div>

      <ul className="space-y-1">
        {RULES.map((rule, index) => (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-[12px] transition-colors duration-200",
              passed[index] ? "text-[var(--success)]" : "text-[var(--fg-subtle)]",
            )}
          >
            {passed[index] ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0" />
            )}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

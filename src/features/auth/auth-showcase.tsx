"use client";

import * as React from "react";
import { Check, Clock } from "lucide-react";

/**
 * «Живий» розклад на екрані входу.
 *
 * Замість статичного скріншота — стрічка записів, яка сама заповнюється:
 * кожні 2.2 с наступний запис підтверджується. Це показує, що саме
 * робить продукт, ще до першого логіну, і відрізняє екран входу від
 * типового «градієнт + три цифри».
 */

const SLOTS = [
  { time: "09:30", client: "Олена К.", service: "Манікюр + покриття", master: "Ірина" },
  { time: "11:00", client: "Марія Т.", service: "Стрижка та укладка", master: "Софія" },
  { time: "12:45", client: "Дарина В.", service: "Догляд за обличчям", master: "Ірина" },
  { time: "14:15", client: "Аліна П.", service: "Ламінування вій", master: "Юлія" },
];

export function AuthShowcase() {
  const [confirmed, setConfirmed] = React.useState(0);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = setInterval(() => {
      setConfirmed((current) => (current + 1) % (SLOTS.length + 1));
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-2">
      {SLOTS.map((slot, index) => {
        const isConfirmed = index < confirmed;
        return (
          <div
            key={slot.time}
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm transition-colors duration-500"
            style={{
              borderColor: isConfirmed ? "rgba(96,150,250,0.28)" : undefined,
              background: isConfirmed ? "rgba(96,150,250,0.08)" : undefined,
            }}
          >
            <span className="w-[42px] shrink-0 text-[12.5px] font-semibold text-slate-300 tabular-nums">
              {slot.time}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">{slot.client}</p>
              <p className="truncate text-[11.5px] text-slate-400">
                {slot.service} · {slot.master}
              </p>
            </div>

            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-500"
              style={{
                background: isConfirmed ? "#3b76f6" : "rgba(255,255,255,0.07)",
                transform: isConfirmed ? "scale(1)" : "scale(0.85)",
              }}
            >
              {isConfirmed ? (
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              ) : (
                <Clock className="h-3 w-3 text-slate-500" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

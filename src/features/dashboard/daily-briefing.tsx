"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Lightbulb, TrendingUp } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { formatMoney } from "@/lib/money";
import { greetingUk, minutesToTime } from "@/lib/time";
import { pluralUk } from "@/lib/utils";

export type BriefingGap = { employeeName: string; startMinute: number; endMinute: number };

export type BriefingData = {
  appointments: number;
  expectedCents: number;
  newClients: number;
  cancelled: number;
  gaps: BriefingGap[];
  bookingUrl: string;
};

/**
 * Ранкове зведення — один абзац замість чотирьох карток.
 *
 * Цифри на дашборді відповідають на «скільки». Зведення відповідає на
 * «що з цим робити»: де в розкладі дірки і чим їх закрити. Саме цим
 * CRM відрізняється від таблиці.
 */
export function DailyBriefing({
  name,
  currency,
  data,
  serverNow,
}: {
  name: string;
  currency: string;
  data: BriefingData;
  serverNow: number;
}) {
  const now = useNow(serverNow, 60_000);
  const greeting = greetingUk(new Date(now));

  /**
   * Показуємо НАЙБІЛЬШЕ вікно, а не суму всіх.
   *
   * Сума вільних годин по всій команді — число, яке виглядає зламаним:
   * у салоні з десятьма майстрами виходить «107 вільних годин сьогодні»,
   * хоча в добі їх 24. Власниці потрібне інше: де саме є діра, яку ще
   * можна закрити, і найбільша з них — найцінніша.
   */
  const ranked = [...data.gaps].sort(
    (a, b) => b.endMinute - b.startMinute - (a.endMinute - a.startMinute),
  );
  const biggest = ranked[0];
  // Округлюємо до цілих годин: 0.4 години тут нічого не додає, а
    // «9,4 години» в українській вимагає ще й іншої форми слова.
  const biggestHours = biggest
    ? Math.round((biggest.endMinute - biggest.startMinute) / 60)
    : 0;
  const mastersWithGaps = new Set(data.gaps.map((gap) => gap.employeeName)).size;

  return (
    <div className="card relative overflow-hidden p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "var(--primary)" }}
      />

      <div className="relative">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--fg)]">
          {greeting}, {name}
        </p>

        {data.appointments === 0 ? (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
            На сьогодні записів немає. Найшвидший спосіб це змінити —{" "}
            <Link href="/calendar?new=1" className="font-medium text-[var(--primary)] hover:underline">
              створити запис
            </Link>{" "}
            або поділитися посиланням на онлайн-запис.
          </p>
        ) : (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
            Сьогодні{" "}
            <strong className="font-semibold text-[var(--fg)]">
              {data.appointments}{" "}
              {pluralUk(data.appointments, "запис", "записи", "записів")}
            </strong>{" "}
            на{" "}
            <strong className="font-semibold text-[var(--fg)]">
              {formatMoney(data.expectedCents, currency)}
            </strong>
            {data.newClients > 0 && (
              <>
                , серед них{" "}
                <strong className="font-semibold text-[var(--fg)]">
                  {data.newClients}{" "}
                  {pluralUk(data.newClients, "новий клієнт", "нові клієнти", "нових клієнтів")}
                </strong>
              </>
            )}
            {data.cancelled > 0 && (
              <>
                {" "}
                · {data.cancelled}{" "}
                {pluralUk(data.cancelled, "скасування", "скасування", "скасувань")}
              </>
            )}
            .
          </p>
        )}

        {data.gaps.length > 0 && (
          <div className="animate-fade-up mt-3.5 flex items-start gap-2.5 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-soft)] px-3.5 py-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
            <div className="min-w-0 text-[12.5px] leading-relaxed text-[var(--warning)]">
              {/* Ім'я стоїть після двокрапки, а не в реченні: інакше
                  «у Софія Литвин» вимагає родового відмінка, а правильно
                  відмінити довільне українське прізвище кодом неможливо. */}
              <p className="font-medium">
                Найбільше вільне вікно: {biggest.employeeName}, {biggestHours}{" "}
                {pluralUk(biggestHours, "година", "години", "годин")}
              </p>
              <p className="mt-0.5 opacity-90">
                {ranked
                  .slice(0, 3)
                  .map(
                    (gap) =>
                      `${gap.employeeName} ${minutesToTime(gap.startMinute)}–${minutesToTime(gap.endMinute)}`,
                  )
                  .join(" · ")}
                {mastersWithGaps > 3 &&
                  ` · вільні вікна ще в ${mastersWithGaps - 3} ${pluralUk(mastersWithGaps - 3, "майстра", "майстрів", "майстрів")}`}
              </p>
              <a
                href={data.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 font-medium underline underline-offset-2"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Поділитися посиланням на запис
              </a>
            </div>
          </div>
        )}

        {data.gaps.length === 0 && data.appointments > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--success)]">
            <TrendingUp className="h-3.5 w-3.5" />
            Розклад заповнений — вільних вікон немає
          </p>
        )}
      </div>
    </div>
  );
}

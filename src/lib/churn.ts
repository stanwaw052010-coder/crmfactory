/**
 * Хто зі клієнтів ось-ось перестане приходити.
 *
 * Ключова ідея: у кожного клієнта свій ритм. Хтось робить манікюр раз на
 * два тижні, хтось стрижеться раз на три місяці — і для другого «не був
 * 45 днів» абсолютно нормально. Загальний поріг у днях однаково помиляється
 * в обидва боки: турбує тих, у кого все гаразд, і мовчить про тих, хто
 * вже пішов.
 *
 * Тому порівнюємо клієнта з ним самим: рахуємо його власний звичний
 * інтервал між візитами і дивимось, наскільки він прострочений.
 */

export type VisitRhythm = {
  /** Медіанний інтервал між візитами, днів. */
  intervalDays: number;
  /** Скільки днів минуло з останнього візиту. */
  sinceDays: number;
  /** Прострочення: 1.0 — прийшов би саме зараз, 2.0 — вдвічі затримався. */
  overdue: number;
};

/** Менше трьох візитів — ритму ще немає, є випадковість. */
export const MIN_VISITS_FOR_RHYTHM = 3;

/** З якого прострочення клієнт вважається таким, що може піти. */
export const AT_RISK_THRESHOLD = 1.5;

/**
 * Медіана, а не середнє.
 *
 * Один візит через рік після паузи зсуває середнє так, що клієнт із
 * ритмом «раз на три тижні» отримує «раз на два місяці» — і система
 * замовкає саме тоді, коли мала б попередити. Медіана таку викидну
 * точку ігнорує.
 */
export function medianInterval(visitDates: Date[]): number | null {
  if (visitDates.length < MIN_VISITS_FOR_RHYTHM) return null;

  const sorted = [...visitDates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i].getTime() - sorted[i - 1].getTime()) / 86_400_000;
    if (days > 0) gaps.push(days);
  }

  if (gaps.length === 0) return null;

  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 0 ? (gaps[middle - 1] + gaps[middle]) / 2 : gaps[middle];

  return Math.round(median);
}

export function visitRhythm(visitDates: Date[], now: Date = new Date()): VisitRhythm | null {
  const intervalDays = medianInterval(visitDates);
  if (intervalDays === null || intervalDays <= 0) return null;

  const last = visitDates.reduce((latest, date) => (date > latest ? date : latest));
  const sinceDays = Math.floor((now.getTime() - last.getTime()) / 86_400_000);

  return {
    intervalDays,
    sinceDays,
    overdue: sinceDays / intervalDays,
  };
}

export type RiskLevel = "watch" | "risk" | "lost";

export function riskLevel(overdue: number): RiskLevel | null {
  if (overdue >= 3) return "lost";
  if (overdue >= AT_RISK_THRESHOLD) return "risk";
  if (overdue >= 1.15) return "watch";
  return null;
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  watch: "Час нагадати",
  risk: "Може піти",
  lost: "Схоже, втрачений",
};

/**
 * Текст повідомлення клієнту.
 *
 * Шаблон, а не генерація: коротке доброзичливе нагадування з іменем і
 * улюбленою послугою працює краще за красивий текст, і його видно
 * наперед — власниця салону надсилає це від свого імені й має розуміти,
 * що саме піде клієнту.
 */
export function followUpMessage(params: {
  firstName: string;
  serviceName?: string | null;
  businessName: string;
}): string {
  const service = params.serviceName
    ? ` Записати вас на «${params.serviceName}»?`
    : " Підібрати для вас зручний час?";

  return `Вітаємо, ${params.firstName}! Давно вас не бачили в ${params.businessName}.${service}`;
}

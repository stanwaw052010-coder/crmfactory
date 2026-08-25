/**
 * Підбір найкращого часу для запису.
 *
 * Просто показати всі вільні вікна вміє будь-який календар. Різниця тут у
 * тому, ЯКИЙ саме час пропонується першим.
 *
 * Головна ідея — не роздрібнювати день. Запис о 14:00 у порожньому дні
 * 09:00–19:00 розрізає його на два шматки; той самий запис одразу після
 * попереднього клієнта лишає один суцільний вільний блок. Для салону це
 * буквально гроші: проміжок у 20 хвилин між клієнтками продати вже
 * нікому, і він тихо зникає з виручки.
 *
 * Другий чинник — улюблений майстер клієнтки. Якщо вона десять разів
 * ходила до Марії, пропонувати Софію першою — щонайменше дивно.
 */

export type BusySpan = { startMinute: number; endMinute: number };

export type SlotCandidate = {
  employeeId: string;
  employeeName: string;
  /** Дата у форматі YYYY-MM-DD. */
  dateKey: string;
  /** Скільки днів від сьогодні: 0 — сьогодні. */
  daysAhead: number;
  startMinute: number;
  /** Вільний інтервал, у який потрапляє слот. */
  interval: { start: number; end: number };
  /** Зайняті проміжки майстра цього дня — з них видно сусідство. */
  busy: BusySpan[];
};

export type ScoredSlot = SlotCandidate & {
  score: number;
  /** Чому цей час запропоновано — рядок для інтерфейсу. */
  reason: string;
};

/**
 * Проміжок, коротший за це, продати вже нікому.
 *
 * Береться найкоротша послуга салону; 20 хвилин — запасний варіант,
 * якщо послуг ще немає.
 */
export const DEAD_GAP_MINUTES = 20;

const WEIGHTS = {
  /** Улюблений майстер клієнтки. */
  preferredEmployee: 40,
  /** Впритул до вже наявного запису — день лишається щільним. */
  adjacent: 22,
  /** Точно заповнює дірку між двома записами — найкращий варіант. */
  fillsHole: 20,
  /** Кожен «мертвий» хвостик, який лишається після запису. */
  deadGap: -30,
  /** Кожен день очікування. */
  dayAhead: -4,
} as const;

export function scoreSlot(
  candidate: SlotCandidate,
  params: { preferredEmployeeId?: string | null; durationMin: number; minServiceMin?: number },
): ScoredSlot {
  const deadGapLimit = Math.max(5, params.minServiceMin ?? DEAD_GAP_MINUTES);
  const end = candidate.startMinute + params.durationMin;

  const touchesBefore = candidate.busy.some((span) => span.endMinute === candidate.startMinute);
  const touchesAfter = candidate.busy.some((span) => span.startMinute === end);

  // Хвостики, що лишаються від вільного інтервалу після цього запису.
  const gapBefore = candidate.startMinute - candidate.interval.start;
  const gapAfter = candidate.interval.end - end;

  const deadBefore = gapBefore > 0 && gapBefore < deadGapLimit;
  const deadAfter = gapAfter > 0 && gapAfter < deadGapLimit;

  let score = 100;
  const reasons: string[] = [];

  const preferred =
    Boolean(params.preferredEmployeeId) &&
    candidate.employeeId === params.preferredEmployeeId;

  if (preferred) {
    score += WEIGHTS.preferredEmployee;
    reasons.push("улюблений майстер");
  }

  if (touchesBefore && touchesAfter) {
    score += WEIGHTS.adjacent + WEIGHTS.fillsHole;
    reasons.push("точно заповнює вікно");
  } else if (touchesBefore) {
    score += WEIGHTS.adjacent;
    reasons.push("одразу після попереднього запису");
  } else if (touchesAfter) {
    score += WEIGHTS.adjacent;
    reasons.push("впритул перед наступним");
  }

  if (deadBefore) score += WEIGHTS.deadGap;
  if (deadAfter) score += WEIGHTS.deadGap;
  if (deadBefore || deadAfter) {
    reasons.push("лишає короткий хвостик");
  }

  score += candidate.daysAhead * WEIGHTS.dayAhead;

  if (reasons.length === 0) {
    reasons.push(candidate.daysAhead === 0 ? "сьогодні" : "найближчий вільний час");
  }

  return { ...candidate, score, reason: reasons[0] };
}

/**
 * Кращі варіанти з усіх кандидатів.
 *
 * З одного майстра беремо не більше двох пропозицій: список із п'яти
 * підряд ідучих слотів однієї Марії не є вибором.
 */
export function bestSlots(
  candidates: SlotCandidate[],
  params: {
    preferredEmployeeId?: string | null;
    durationMin: number;
    minServiceMin?: number;
    limit?: number;
    perEmployee?: number;
  },
): ScoredSlot[] {
  const limit = params.limit ?? 5;
  const perEmployee = params.perEmployee ?? 2;

  const scored = candidates
    .map((candidate) => scoreSlot(candidate, params))
    .sort((a, b) => b.score - a.score || a.startMinute - b.startMinute);

  const taken = new Map<string, number>();
  const result: ScoredSlot[] = [];

  for (const slot of scored) {
    const used = taken.get(slot.employeeId) ?? 0;
    if (used >= perEmployee) continue;
    taken.set(slot.employeeId, used + 1);
    result.push(slot);
    if (result.length >= limit) break;
  }

  return result;
}

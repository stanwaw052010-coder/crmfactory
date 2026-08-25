/**
 * Business Health Score.
 *
 * Найлегше тут — намалювати красиве число. Найважче — щоб воно не брехало.
 *
 * Три правила, яких дотримується весь цей файл:
 *
 * 1. **Порівнюємо бізнес із ним самим**, а не з вигаданими нормами галузі.
 *    «Добре» для салону на одного майстра і для мережі — різні числа, і
 *    єдина чесна точка відліку — попередній період цього ж салону.
 *
 * 2. **Мало даних — немає оцінки.** Два клієнти проти одного це не «плюс
 *    100%», це просто мало клієнтів. Там, де вибірка замала, метрика
 *    повертає `null` і чесно каже «ще рано судити», а не підставляє
 *    правдоподібне число.
 *
 * 3. **Не всяке зростання добре.** Завантаження команди на 98% — не
 *    відмінник, а салон без жодного вільного вікна й із командою на межі.
 *    Тому для завантаження здоровим є діапазон, а не максимум.
 */

export type MetricKey = "revenue" | "retention" | "bookings" | "clients" | "team";

export type HealthMetric = {
  key: MetricKey;
  label: string;
  /** 0–100, або null коли даних замало для висновку. */
  score: number | null;
  /** Короткий факт: що саме виміряно. */
  headline: string;
  /** Пояснення людською мовою — чому саме така оцінка. */
  detail: string;
  action?: { label: string; href: string };
};

/** Вага метрики в загальній оцінці. Сума — 100. */
const WEIGHTS: Record<MetricKey, number> = {
  revenue: 25,
  retention: 25,
  bookings: 20,
  clients: 15,
  team: 15,
};

/**
 * Зміна у відсотках → оцінка 0–100.
 *
 * Опорні точки підібрані так, щоб стабільність не читалась як провал:
 * −30% дає 0, +15% дає 100, між ними лінійно. Бізнес без змін виходить
 * на 67 — «усе гаразд, але без руху», а не «погано».
 */
export function trendScore(current: number, previous: number): number | null {
  // Нульова база: ділити нема на що, а «з 0 до 3» — це не «+300%».
  if (previous <= 0) {
    if (current <= 0) return 0;
    return 85; // Зростання з нуля — добре, але без бази для порівняння.
  }

  const delta = ((current - previous) / previous) * 100;
  return clamp(mapRange(delta, -30, 15, 0, 100), 0, 100);
}

/**
 * Оцінка для метрики, здорове значення якої лежить у діапазоні.
 * Усередині діапазону — 100, за його межами оцінка спадає до нуля
 * на відстані `falloff` відсоткових пунктів.
 */
export function bandScore(
  value: number,
  low: number,
  high: number,
  falloff = 40,
): number {
  if (value >= low && value <= high) return 100;
  const distance = value < low ? low - value : value - high;
  return clamp(100 - (distance / falloff) * 100, 0, 100);
}

function mapRange(
  value: number,
  fromLow: number,
  fromHigh: number,
  toLow: number,
  toHigh: number,
): number {
  const ratio = (value - fromLow) / (fromHigh - fromLow);
  return toLow + ratio * (toHigh - toLow);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Загальна оцінка — зважене середнє наявних метрик.
 *
 * Метрики без оцінки не «тягнуть донизу» нулем: вони просто не беруть
 * участі, а ваги перераховуються між рештою. Салон, що працює перший
 * тиждень, не має бачити 30/100 лише тому, що історії ще немає.
 */
export function overallScore(metrics: HealthMetric[]): number | null {
  const scored = metrics.filter(
    (metric): metric is HealthMetric & { score: number } => metric.score !== null,
  );
  if (scored.length === 0) return null;

  const totalWeight = scored.reduce((sum, metric) => sum + WEIGHTS[metric.key], 0);
  const weighted = scored.reduce(
    (sum, metric) => sum + metric.score * WEIGHTS[metric.key],
    0,
  );

  return Math.round(weighted / totalWeight);
}

export type HealthBand = { label: string; tone: "success" | "warning" | "danger" };

export function healthBand(score: number): HealthBand {
  if (score >= 80) return { label: "Усе добре", tone: "success" };
  if (score >= 60) return { label: "Є що підтягнути", tone: "warning" };
  return { label: "Потребує уваги", tone: "danger" };
}

export const METRIC_WEIGHTS = WEIGHTS;

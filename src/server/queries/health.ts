import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays, startOfDay } from "@/lib/time";
import {
  bandScore,
  healthBand,
  overallScore,
  trendScore,
  type HealthMetric,
} from "@/lib/health";
import { formatMoney } from "@/lib/money";
import { pluralUk } from "@/lib/utils";

export type HealthReport = Awaited<ReturnType<typeof getBusinessHealth>>;

/** Вікно спостереження. 30 днів — достатньо, щоб згладити тижневі коливання. */
const WINDOW_DAYS = 30;

/** Скільки подій потрібно, щоб узагалі щось стверджувати. */
const MIN_SAMPLE = 5;

/**
 * Здорове завантаження команди.
 *
 * Нижня межа — простій. Верхня теж важлива: салон, забитий на 95%, не має
 * куди зростати, не встигає прийняти постійного клієнта і вигорає. Тому
 * норма — діапазон, а не максимум.
 */
const UTILISATION_BAND: [number, number] = [55, 85];

export async function getBusinessHealth(organizationId: string) {
  const now = new Date();
  const windowStart = addDays(startOfDay(now), -WINDOW_DAYS);
  const previousStart = addDays(windowStart, -WINDOW_DAYS);
  const retentionStart = addDays(startOfDay(now), -180);

  const [
    revenueNow,
    revenuePrev,
    completedNow,
    completedPrev,
    failedNow,
    clientsNow,
    clientsPrev,
    retentionRows,
    employees,
    bookedMinutes,
    exceptions,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { organizationId, status: "PAID", paidAt: { gte: windowStart } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId,
        status: "PAID",
        paidAt: { gte: previousStart, lt: windowStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.appointment.count({
      where: { organizationId, status: "COMPLETED", startAt: { gte: windowStart } },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        status: "COMPLETED",
        startAt: { gte: previousStart, lt: windowStart },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId,
        status: { in: ["CANCELLED", "NO_SHOW"] },
        startAt: { gte: windowStart },
      },
    }),
    prisma.client.count({ where: { organizationId, createdAt: { gte: windowStart } } }),
    prisma.client.count({
      where: { organizationId, createdAt: { gte: previousStart, lt: windowStart } },
    }),
    // Скільки завершених візитів у кожного клієнта за півроку —
    // основа для утримання. Групування рахує Postgres, не Node.
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { organizationId, status: "COMPLETED", startAt: { gte: retentionStart } },
      _count: { _all: true },
    }),
    prisma.employee.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, schedules: true },
    }),
    // Беремо самі проміжки, а не кількість: тривалість візитів різна, і
    // множення числа записів на «середню годину» дало б точний на вигляд
    // відсоток, зібраний із вигаданого числа.
    prisma.appointment.findMany({
      where: {
        organizationId,
        status: { in: ["COMPLETED", "CONFIRMED"] },
        startAt: { gte: windowStart },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.scheduleException.findMany({
      where: {
        employee: { organizationId },
        date: { gte: windowStart },
      },
      select: { employeeId: true, date: true, endDate: true, type: true },
    }),
  ]);

  const revenueCents = revenueNow._sum.amountCents ?? 0;
  const revenuePrevCents = revenuePrev._sum.amountCents ?? 0;

  // ── Виручка ──────────────────────────────────────────────────────────
  const revenueMetric: HealthMetric = {
    key: "revenue",
    label: "Виручка",
    score:
      revenueCents === 0 && revenuePrevCents === 0
        ? null
        : trendScore(revenueCents, revenuePrevCents),
    headline: formatMoney(revenueCents, "EUR"),
    detail:
      revenueCents === 0 && revenuePrevCents === 0
        ? "За два місяці ще не було оплат — оцінювати нема чого."
        : describeTrend(revenueCents, revenuePrevCents, "виручка"),
    action: { label: "Відкрити продажі", href: "/sales" },
  };

  // ── Записи ───────────────────────────────────────────────────────────
  const totalAttempts = completedNow + failedNow;
  const failRate = totalAttempts > 0 ? (failedNow / totalAttempts) * 100 : 0;
  const bookingsBase =
    completedNow + completedPrev < MIN_SAMPLE
      ? null
      : trendScore(completedNow, completedPrev);

  const bookingsMetric: HealthMetric = {
    key: "bookings",
    label: "Записи",
    // Зриви віднімаються від оцінки напряму: 20% скасувань — це мінус
    // 20 балів, скільки б не було зростання. Саме так це відчуває салон.
    score: bookingsBase === null ? null : Math.round(Math.max(0, bookingsBase - failRate)),
    headline: `${completedNow} ${pluralUk(completedNow, "візит", "візити", "візитів")}`,
    detail:
      bookingsBase === null
        ? "Замало записів, щоб робити висновки про динаміку."
        : failRate >= 10
          ? `${Math.round(failRate)}% записів зірвалися — скасування або неявка. Це найдорожчі години в розкладі.`
          : describeTrend(completedNow, completedPrev, "кількість візитів"),
    action: { label: "Відкрити календар", href: "/calendar" },
  };

  // ── Клієнти ──────────────────────────────────────────────────────────
  const clientsMetric: HealthMetric = {
    key: "clients",
    label: "Нові клієнти",
    score:
      clientsNow + clientsPrev < MIN_SAMPLE ? null : trendScore(clientsNow, clientsPrev),
    headline: `${clientsNow} ${pluralUk(clientsNow, "новий", "нові", "нових")}`,
    detail:
      clientsNow + clientsPrev < MIN_SAMPLE
        ? "Нових клієнтів поки замало для оцінки динаміки."
        : describeTrend(clientsNow, clientsPrev, "приплив нових клієнтів"),
    action: { label: "Відкрити клієнтів", href: "/clients" },
  };

  // ── Утримання ────────────────────────────────────────────────────────
  const withVisits = retentionRows.length;
  const returning = retentionRows.filter((row) => row._count._all >= 2).length;
  const returnRate = withVisits > 0 ? (returning / withVisits) * 100 : 0;

  const retentionMetric: HealthMetric = {
    key: "retention",
    label: "Утримання",
    // Повернення 50% клієнтів — уже добрий показник для сфери послуг,
    // тому шкала виходить на 100 саме там, а не на недосяжних 100%.
    score: withVisits < MIN_SAMPLE ? null : Math.round(Math.min(100, returnRate * 2)),
    headline: `${Math.round(returnRate)}%`,
    detail:
      withVisits < MIN_SAMPLE
        ? "Ще замало клієнтів з історією візитів."
        : `${returning} із ${withVisits} клієнтів приходили більше одного разу за півроку. Повторний візит коштує салону в рази дешевше за нового клієнта.`,
    action: { label: "Кого варто повернути", href: "/clients?filter=lapsed" },
  };

  // ── Команда ──────────────────────────────────────────────────────────
  const availableMinutes = countAvailableMinutes(employees, exceptions, windowStart, now);
  const busyMinutes = bookedMinutes.reduce(
    (sum, appointment) =>
      sum + (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60_000,
    0,
  );
  const utilisation =
    availableMinutes > 0 ? (busyMinutes / availableMinutes) * 100 : 0;

  const teamMetric: HealthMetric = {
    key: "team",
    label: "Завантаження",
    score:
      employees.length === 0 || availableMinutes === 0
        ? null
        : Math.round(bandScore(utilisation, UTILISATION_BAND[0], UTILISATION_BAND[1])),
    headline: `${Math.round(utilisation)}%`,
    detail:
      employees.length === 0
        ? "У команді ще немає активних співробітників."
        : utilisation > UTILISATION_BAND[1]
          ? "Розклад майже забитий. Це добре для виручки, але постійному клієнту вже нема куди записатися — час думати про ще одного майстра."
          : utilisation < UTILISATION_BAND[0]
            ? "У розкладі багато вільних годин. Найдешевший спосіб їх заповнити — нагадати клієнтам, які давно не приходили."
            : "Завантаження в комфортному діапазоні: і виручка йде, і вільні вікна лишаються.",
    action: { label: "Графік команди", href: "/employees" },
  };

  const metrics = [
    revenueMetric,
    retentionMetric,
    bookingsMetric,
    clientsMetric,
    teamMetric,
  ];
  const total = overallScore(metrics);

  return {
    score: total,
    band: total === null ? null : healthBand(total),
    metrics,
    windowDays: WINDOW_DAYS,
  };
}

function describeTrend(current: number, previous: number, subject: string): string {
  if (previous <= 0) return `Порівнювати ще нема з чим — минулого місяця ${subject} була нульова.`;
  const delta = Math.round(((current - previous) / previous) * 100);
  if (delta === 0) return `Без змін до попереднього місяця.`;
  return delta > 0
    ? `За місяць ${subject} зросла на ${delta}% проти попереднього.`
    : `За місяць ${subject} просіла на ${Math.abs(delta)}% проти попереднього.`;
}

type ScheduleRow = { weekday: number; startMinute: number; endMinute: number; isDayOff: boolean };
type ExceptionRow = { employeeId: string; date: Date; endDate: Date | null; type: string };

/**
 * Робочі хвилини команди за період.
 *
 * Рахуємо по днях, а не «тиждень × 4.3»: у місяці різна кількість
 * суботами, і множення дає похибку в десятки годин. Відпустки й вихідні
 * з винятків віднімаються — інакше завантаження салону, де майстер був
 * два тижні у відпустці, виглядало б удвічі нижчим, ніж є насправді.
 */
function countAvailableMinutes(
  employees: { id: string; schedules: ScheduleRow[] }[],
  exceptions: ExceptionRow[],
  from: Date,
  to: Date,
): number {
  let minutes = 0;

  for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
    const weekday = day.getDay();
    const dayStart = startOfDay(day).getTime();

    for (const employee of employees) {
      const schedule = employee.schedules.find((row) => row.weekday === weekday);
      if (!schedule || schedule.isDayOff) continue;

      const away = exceptions.some((exception) => {
        if (exception.employeeId !== employee.id) return false;
        const start = startOfDay(exception.date).getTime();
        const end = startOfDay(exception.endDate ?? exception.date).getTime();
        return dayStart >= start && dayStart <= end;
      });
      if (away) continue;

      minutes += Math.max(0, schedule.endMinute - schedule.startMinute);
    }
  }

  return minutes;
}

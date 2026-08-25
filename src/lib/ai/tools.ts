import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays, startOfDay } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { MIN_VISITS_FOR_RHYTHM, riskLevel, visitRhythm } from "@/lib/churn";

/**
 * Інструменти, якими factory AI дістає дані бізнесу.
 *
 * Головне архітектурне рішення: модель НЕ пише SQL і НЕ передає
 * `organizationId`. Вона лише обирає інструмент і параметри на кшталт
 * «за скільки днів»; ідентифікатор організації підставляє сервер із
 * сесії. Тому жодне формулювання питання — ані випадкове, ані навмисне —
 * не може дістати чужі дані: у запиті до бази просто немає місця, куди
 * модель могла б підставити чужий id.
 *
 * Другий наслідок: відповіді завжди рахує Postgres, а не модель. LLM
 * гарно формулює, але не має складати гроші — тому інструменти
 * повертають уже готові числа, а моделі лишається їх пояснити.
 */

export type ToolContext = { organizationId: string; currency: string };

/** Скільки днів дивитись, якщо модель не вказала. */
const DEFAULT_PERIOD = 30;

function clampPeriod(days: unknown): number {
  const value = Number(days);
  if (!Number.isFinite(value)) return DEFAULT_PERIOD;
  return Math.min(365, Math.max(1, Math.round(value)));
}

function clampLimit(limit: unknown, fallback = 5): number {
  const value = Number(limit);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(25, Math.max(1, Math.round(value)));
}

const periodProperty = {
  periodDays: {
    type: "number" as const,
    description: "За скільки останніх днів рахувати. За замовчуванням 30.",
  },
};

export const AI_TOOLS = [
  {
    name: "get_revenue",
    description:
      "Виручка за період і порівняння з попереднім таким самим періодом. Використовуй для питань про гроші, доходи, «скільки заробили», зростання чи падіння виручки.",
    input_schema: {
      type: "object" as const,
      properties: periodProperty,
      required: [],
    },
  },
  {
    name: "get_top_services",
    description:
      "Послуги, відсортовані за виручкою: скільки разів надано і на яку суму. Використовуй для питань «які послуги приносять найбільше», «що найпопулярніше».",
    input_schema: {
      type: "object" as const,
      properties: {
        ...periodProperty,
        limit: { type: "number" as const, description: "Скільки послуг повернути, до 25." },
      },
      required: [],
    },
  },
  {
    name: "get_top_employees",
    description:
      "Співробітники за виручкою та кількістю завершених візитів. Для питань про команду, хто скільки заробив, хто найзавантаженіший.",
    input_schema: {
      type: "object" as const,
      properties: {
        ...periodProperty,
        limit: { type: "number" as const, description: "Скільки співробітників повернути, до 25." },
      },
      required: [],
    },
  },
  {
    name: "get_appointments_summary",
    description:
      "Записи за період: завершені, скасовані, неявки, середній чек. Для питань про завантаження, скасування, кількість візитів.",
    input_schema: {
      type: "object" as const,
      properties: periodProperty,
      required: [],
    },
  },
  {
    name: "get_client_stats",
    description:
      "Клієнти за період: скільки нових, скільки повернулось, загальна база. Для питань про приплив клієнтів і утримання.",
    input_schema: {
      type: "object" as const,
      properties: periodProperty,
      required: [],
    },
  },
  {
    name: "get_lapsed_clients",
    description:
      "Клієнти, які прострочили СВІЙ звичний інтервал між візитами і можуть піти. Для питань «кому пора нагадати», «хто давно не приходив», «кого варто повернути».",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" as const, description: "Скільки клієнтів повернути, до 25." },
      },
      required: [],
    },
  },
] as const;

export type ToolName = (typeof AI_TOOLS)[number]["name"];

/**
 * Виконання інструмента.
 *
 * Повертає рядок — модель читає його як текст. Гроші форматуються тут же
 * у валюті салону, щоб модель не переводила центи в євро самотужки
 * (саме на такій арифметиці LLM і помиляються).
 */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const { organizationId, currency } = ctx;
  const money = (cents: number) => formatMoney(cents, currency);

  switch (name) {
    case "get_revenue": {
      const days = clampPeriod(input.periodDays);
      const from = addDays(startOfDay(new Date()), -days);
      const prevFrom = addDays(from, -days);

      const [now, prev] = await Promise.all([
        prisma.payment.aggregate({
          where: { organizationId, status: "PAID", paidAt: { gte: from } },
          _sum: { amountCents: true },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: {
            organizationId,
            status: "PAID",
            paidAt: { gte: prevFrom, lt: from },
          },
          _sum: { amountCents: true },
        }),
      ]);

      const current = now._sum.amountCents ?? 0;
      const previous = prev._sum.amountCents ?? 0;
      const delta =
        previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

      return JSON.stringify({
        periodDays: days,
        revenue: money(current),
        payments: now._count._all,
        previousPeriodRevenue: money(previous),
        changePercent: delta,
      });
    }

    case "get_top_services": {
      const days = clampPeriod(input.periodDays);
      const limit = clampLimit(input.limit);
      const from = addDays(startOfDay(new Date()), -days);

      const rows = await prisma.appointment.groupBy({
        by: ["serviceId"],
        where: { organizationId, status: "COMPLETED", startAt: { gte: from } },
        _sum: { priceCents: true },
        _count: { _all: true },
      });

      const services = await prisma.service.findMany({
        where: { id: { in: rows.map((row) => row.serviceId) } },
        select: { id: true, name: true },
      });
      const names = new Map(services.map((service) => [service.id, service.name]));

      const result = rows
        .map((row) => ({
          service: names.get(row.serviceId) ?? "Невідома послуга",
          revenue: row._sum.priceCents ?? 0,
          visits: row._count._all,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
        .map((row) => ({ ...row, revenue: money(row.revenue) }));

      return JSON.stringify({ periodDays: days, services: result });
    }

    case "get_top_employees": {
      const days = clampPeriod(input.periodDays);
      const limit = clampLimit(input.limit);
      const from = addDays(startOfDay(new Date()), -days);

      const rows = await prisma.appointment.groupBy({
        by: ["employeeId"],
        where: { organizationId, status: "COMPLETED", startAt: { gte: from } },
        _sum: { priceCents: true },
        _count: { _all: true },
      });

      const employees = await prisma.employee.findMany({
        where: { id: { in: rows.map((row) => row.employeeId) } },
        select: { id: true, name: true, position: true },
      });
      const byId = new Map(employees.map((employee) => [employee.id, employee]));

      const result = rows
        .map((row) => ({
          name: byId.get(row.employeeId)?.name ?? "Невідомий співробітник",
          position: byId.get(row.employeeId)?.position ?? null,
          revenue: row._sum.priceCents ?? 0,
          visits: row._count._all,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
        .map((row) => ({ ...row, revenue: money(row.revenue) }));

      return JSON.stringify({ periodDays: days, employees: result });
    }

    case "get_appointments_summary": {
      const days = clampPeriod(input.periodDays);
      const from = addDays(startOfDay(new Date()), -days);

      const [completed, cancelled, noShow, revenue] = await Promise.all([
        prisma.appointment.count({
          where: { organizationId, status: "COMPLETED", startAt: { gte: from } },
        }),
        prisma.appointment.count({
          where: { organizationId, status: "CANCELLED", startAt: { gte: from } },
        }),
        prisma.appointment.count({
          where: { organizationId, status: "NO_SHOW", startAt: { gte: from } },
        }),
        prisma.appointment.aggregate({
          where: { organizationId, status: "COMPLETED", startAt: { gte: from } },
          _sum: { priceCents: true },
        }),
      ]);

      const total = completed + cancelled + noShow;
      const revenueCents = revenue._sum.priceCents ?? 0;

      return JSON.stringify({
        periodDays: days,
        completed,
        cancelled,
        noShow,
        failureRatePercent: total > 0 ? Math.round(((cancelled + noShow) / total) * 100) : 0,
        averageCheck: completed > 0 ? money(Math.round(revenueCents / completed)) : money(0),
      });
    }

    case "get_client_stats": {
      const days = clampPeriod(input.periodDays);
      const from = addDays(startOfDay(new Date()), -days);

      const [newClients, totalClients, visitRows] = await Promise.all([
        prisma.client.count({ where: { organizationId, createdAt: { gte: from } } }),
        prisma.client.count({ where: { organizationId } }),
        prisma.appointment.groupBy({
          by: ["clientId"],
          where: { organizationId, status: "COMPLETED", startAt: { gte: from } },
          _count: { _all: true },
        }),
      ]);

      const returning = visitRows.filter((row) => row._count._all >= 2).length;

      return JSON.stringify({
        periodDays: days,
        newClients,
        totalClients,
        clientsWithVisits: visitRows.length,
        clientsWhoReturned: returning,
      });
    }

    case "get_lapsed_clients": {
      const limit = clampLimit(input.limit, 10);
      const now = new Date();
      const from = addDays(startOfDay(now), -400);

      const [visits, upcoming] = await Promise.all([
        prisma.appointment.findMany({
          where: { organizationId, status: "COMPLETED", startAt: { gte: from, lte: now } },
          select: {
            clientId: true,
            startAt: true,
            client: { select: { firstName: true, lastName: true, status: true } },
          },
          orderBy: { startAt: "asc" },
        }),
        prisma.appointment.findMany({
          where: { organizationId, status: { in: ["CONFIRMED", "WAITING"] }, startAt: { gt: now } },
          select: { clientId: true },
        }),
      ]);

      const booked = new Set(upcoming.map((row) => row.clientId));
      const byClient = new Map<string, { dates: Date[]; name: string }>();

      for (const visit of visits) {
        if (!visit.client || visit.client.status === "BLOCKED") continue;
        if (booked.has(visit.clientId)) continue;

        const bucket = byClient.get(visit.clientId) ?? {
          dates: [],
          name: `${visit.client.firstName} ${visit.client.lastName ?? ""}`.trim(),
        };
        bucket.dates.push(visit.startAt);
        byClient.set(visit.clientId, bucket);
      }

      const lapsed: { name: string; usualIntervalDays: number; daysSinceVisit: number }[] = [];

      for (const bucket of byClient.values()) {
        if (bucket.dates.length < MIN_VISITS_FOR_RHYTHM) continue;
        const rhythm = visitRhythm(bucket.dates, now);
        if (!rhythm) continue;
        const level = riskLevel(rhythm.overdue);
        if (level === null || level === "watch") continue;

        lapsed.push({
          name: bucket.name,
          usualIntervalDays: rhythm.intervalDays,
          daysSinceVisit: rhythm.sinceDays,
        });
      }

      lapsed.sort((a, b) => b.daysSinceVisit / b.usualIntervalDays - a.daysSinceVisit / a.usualIntervalDays);

      return JSON.stringify({
        method:
          "Порівняння з власним ритмом кожного клієнта, а не з єдиним порогом у днях.",
        clients: lapsed.slice(0, limit),
      });
    }

    default:
      return JSON.stringify({ error: `Невідомий інструмент: ${name}` });
  }
}

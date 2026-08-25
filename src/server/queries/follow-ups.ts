import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays, startOfDay } from "@/lib/time";
import {
  MIN_VISITS_FOR_RHYTHM,
  followUpMessage,
  riskLevel,
  visitRhythm,
  type RiskLevel,
} from "@/lib/churn";

export type FollowUp = {
  clientId: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  level: RiskLevel;
  intervalDays: number;
  sinceDays: number;
  favouriteService: string | null;
  totalCents: number;
  message: string;
};

/** Історія глибша за рік нічого не додає, а запит важчає. */
const HISTORY_DAYS = 400;

/**
 * Клієнти, яких варто повернути.
 *
 * Вибираємо тих, хто вже прострочив ВЛАСНИЙ звичний ритм — див. lib/churn.ts.
 * Клієнти з майбутнім записом до списку не потрапляють: вони вже
 * повертаються, і нагадування виглядало б безглуздо.
 */
export async function getFollowUps(
  organizationId: string,
  businessName: string,
  limit = 12,
): Promise<FollowUp[]> {
  const now = new Date();
  const since = addDays(startOfDay(now), -HISTORY_DAYS);

  const [visits, upcoming] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        status: "COMPLETED",
        startAt: { gte: since, lte: now },
      },
      select: {
        clientId: true,
        startAt: true,
        priceCents: true,
        service: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, phone: true, status: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId,
        status: { in: ["CONFIRMED", "WAITING"] },
        startAt: { gt: now },
      },
      select: { clientId: true },
    }),
  ]);

  const hasUpcoming = new Set(upcoming.map((row) => row.clientId));

  type Bucket = {
    dates: Date[];
    services: Map<string, number>;
    totalCents: number;
    client: { firstName: string; lastName: string | null; phone: string | null; status: string };
  };

  const byClient = new Map<string, Bucket>();

  for (const visit of visits) {
    if (!visit.client) continue;
    // Заблокованих не турбуємо — їх виключили свідомо.
    if (visit.client.status === "BLOCKED") continue;
    if (hasUpcoming.has(visit.clientId)) continue;

    const bucket = byClient.get(visit.clientId) ?? {
      dates: [],
      services: new Map<string, number>(),
      totalCents: 0,
      client: visit.client,
    };

    bucket.dates.push(visit.startAt);
    bucket.totalCents += visit.priceCents;
    const serviceName = visit.service?.name;
    if (serviceName) {
      bucket.services.set(serviceName, (bucket.services.get(serviceName) ?? 0) + 1);
    }

    byClient.set(visit.clientId, bucket);
  }

  const result: FollowUp[] = [];

  for (const [clientId, bucket] of byClient) {
    if (bucket.dates.length < MIN_VISITS_FOR_RHYTHM) continue;

    const rhythm = visitRhythm(bucket.dates, now);
    if (!rhythm) continue;

    const level = riskLevel(rhythm.overdue);
    if (level === null || level === "watch") continue;

    const favouriteService =
      [...bucket.services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    result.push({
      clientId,
      firstName: bucket.client.firstName,
      lastName: bucket.client.lastName,
      phone: bucket.client.phone,
      level,
      intervalDays: rhythm.intervalDays,
      sinceDays: rhythm.sinceDays,
      favouriteService,
      totalCents: bucket.totalCents,
      message: followUpMessage({
        firstName: bucket.client.firstName,
        serviceName: favouriteService,
        businessName,
      }),
    });
  }

  // Спершу ті, хто ще не пішов остаточно, і хто приносив більше грошей:
  // саме на них нагадування має найбільший шанс спрацювати.
  const order: Record<RiskLevel, number> = { risk: 0, lost: 1, watch: 2 };
  result.sort(
    (a, b) => order[a.level] - order[b.level] || b.totalCents - a.totalCents,
  );

  return result.slice(0, limit);
}

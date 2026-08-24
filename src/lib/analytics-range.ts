/** Діапазони аналітики — спільні для сервера й клієнта, без доступу до БД. */

export type AnalyticsRange = "7d" | "30d" | "90d" | "365d";

export const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "7 днів",
  "30d": "30 днів",
  "90d": "3 місяці",
  "365d": "Рік",
};

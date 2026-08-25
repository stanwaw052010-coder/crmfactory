/**
 * Лояльність клієнта — те, що дані вже знають, але інтерфейс не казав.
 *
 * У CRM є статус (NEW / ACTIVE / VIP / …), який ставлять руками. Рівень
 * лояльності — інша річ: він рахується з історії візитів і не бреше.
 * Разом вони корисніші за кожен окремо: видно, коли людину давно час
 * перевести у VIP, а її досі позначено як нову.
 *
 * Формулювання навмисно іменникові («Перший візит», «Останній візит —
 * 3 місяці тому»), а не дієслівні чи прикметникові: українське минуле
 * і прикметники мають рід, і будь-який вибір був би неправильним для
 * половини клієнтів.
 */

export type LoyaltyKey = "new" | "first" | "returning" | "regular" | "vip";

export type LoyaltyTier = {
  key: LoyaltyKey;
  label: string;
  /** Мінімальна кількість завершених візитів для рівня. */
  minVisits: number;
  /** Токен теми — щоб значок жив у світлій і темній однаково. */
  tone: "muted" | "info" | "brand" | "success" | "warning";
  hint: string;
};

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    key: "new",
    label: "Новий клієнт",
    minVisits: 0,
    tone: "muted",
    hint: "Ще жодного завершеного візиту",
  },
  {
    key: "first",
    label: "Перший візит",
    minVisits: 1,
    tone: "info",
    hint: "Був один візит — саме зараз вирішується, чи буде другий",
  },
  {
    key: "returning",
    label: "Повертається",
    minVisits: 2,
    tone: "brand",
    hint: "Прийшов повторно — вибір на вашу користь уже зроблено",
  },
  {
    key: "regular",
    label: "Постійний клієнт",
    minVisits: 5,
    tone: "success",
    hint: "Ходить регулярно — основа виручки салону",
  },
  {
    key: "vip",
    label: "VIP",
    minVisits: 15,
    tone: "warning",
    hint: "Найцінніші клієнти — їх варто знати поіменно",
  },
];

export function loyaltyTier(visits: number): LoyaltyTier {
  // Йдемо з кінця: перший рівень, поріг якого пройдено, і є поточним.
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    if (visits >= LOYALTY_TIERS[i].minVisits) return LOYALTY_TIERS[i];
  }
  return LOYALTY_TIERS[0];
}

/** Скільки візитів до наступного рівня; `null` — рівень уже найвищий. */
export function nextLoyaltyStep(
  visits: number,
): { tier: LoyaltyTier; remaining: number; progress: number } | null {
  const current = loyaltyTier(visits);
  const index = LOYALTY_TIERS.findIndex((tier) => tier.key === current.key);
  const next = LOYALTY_TIERS[index + 1];
  if (!next) return null;

  const span = next.minVisits - current.minVisits;
  const done = visits - current.minVisits;

  return {
    tier: next,
    remaining: next.minVisits - visits,
    progress: span > 0 ? Math.min(1, done / span) : 1,
  };
}

/**
 * Днів від останнього візиту. Головна причина, чому це важливо: клієнт,
 * який не приходив три місяці, найчастіше не образився — про нього
 * просто забули нагадати.
 */
export function daysSince(date: Date | null, now: Date = new Date()): number | null {
  if (!date) return null;
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  return days < 0 ? 0 : days;
}

/** Поріг, після якого клієнта варто повернути. */
export const LAPSED_DAYS = 60;

export function lapsedLabel(days: number | null): string | null {
  if (days === null || days < LAPSED_DAYS) return null;
  if (days < 90) return "Останній візит — понад 2 місяці тому";
  if (days < 180) return "Останній візит — понад 3 місяці тому";
  if (days < 365) return "Останній візит — понад пів року тому";
  return "Останній візит — понад рік тому";
}

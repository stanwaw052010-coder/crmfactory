import type { Plan } from "@prisma/client";

/**
 * Тарифи платформи.
 *
 * Ціни живуть тут, а не дублюються в кожній дії — інакше MRR в адмінці
 * і сума на сторінці білінгу починають розходитися.
 *
 * Важливо: зараз тариф НЕ обмежує функціонал — це мітка й основа для
 * майбутнього білінгу. Ліміти додаються сюди ж, коли з'явиться оплата.
 */
export const PLAN_PRICE_CENTS: Record<Plan, number> = {
  FREE: 0,
  STARTER: 1900,
  BUSINESS: 3900,
  PRO: 7900,
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  STARTER: "Starter",
  BUSINESS: "Business",
  PRO: "Pro",
};

export const PLAN_ORDER: Plan[] = ["FREE", "STARTER", "BUSINESS", "PRO"];

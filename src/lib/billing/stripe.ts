import "server-only";
import Stripe from "stripe";
import type { Plan } from "@prisma/client";

/**
 * Інтеграція зі Stripe.
 *
 * Ключі опційні: без них застосунок повністю працездатний, лише кнопки
 * оплати показують, що білінг ще не підключено. Це навмисно — CRM має
 * піднятися й працювати до того, як власник оформить Stripe-акаунт.
 */

let cached: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY не налаштовано");
  if (!cached) cached = new Stripe(key);
  return cached;
}

/**
 * Ідентифікатори цін зі Stripe Dashboard. Ціна живе там, а не в коді:
 * інакше зміна вартості вимагала б деплою, а вже оформлені підписки
 * лишалися б на старій сумі й розходилися з тим, що показує застосунок.
 */
export function priceIdFor(plan: Plan): string | null {
  const ids: Record<Plan, string | undefined> = {
    FREE: undefined,
    STARTER: process.env.STRIPE_PRICE_STARTER,
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
    PRO: process.env.STRIPE_PRICE_PRO,
  };
  return ids[plan] ?? null;
}

/** Зворотне зіставлення: із price id у вебхуку — у наш тариф. */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "STARTER";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  return null;
}

/** Статуси Stripe → наші. Все, що не «жива підписка», веде на FREE. */
export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    default:
      return "CANCELED";
  }
}

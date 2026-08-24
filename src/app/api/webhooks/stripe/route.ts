import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import {
  getStripe,
  mapSubscriptionStatus,
  planFromPriceId,
  stripeEnabled,
} from "@/lib/billing/stripe";
import { PLAN_PRICE_CENTS } from "@/lib/plans";

/**
 * Вебхук Stripe — єдине джерело правди про стан підписки.
 *
 * Повернення користувача на success_url НЕ означає, що гроші пройшли:
 * вкладку можна закрити, а платіж може завершитися пізніше. Тому тариф
 * змінює лише ця обробка, і тільки після перевірки підпису — інакше
 * будь-хто міг би відкрити собі Pro запитом на цей URL.
 */

// Підпис рахується від «сирого» тіла запиту, тож кешування тут неприпустиме.
export const dynamic = "force-dynamic";

async function applySubscription(subscription: Stripe.Subscription) {
  const organizationId =
    (subscription.metadata?.organizationId as string | undefined) ?? null;
  if (!organizationId) {
    console.error("[stripe] підписка без organizationId у metadata", subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const plan = planFromPriceId(item?.price?.id);
  if (!plan) {
    console.error("[stripe] невідомий price id", item?.price?.id);
    return;
  }

  const status = mapSubscriptionStatus(subscription.status);
  // Скасована або неоплачена підписка повертає організацію на Free —
  // інакше після відмови від оплати платні розділи лишилися б відкритими.
  const effectivePlan = status === "CANCELED" ? "FREE" : plan;

  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : new Date();

  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan: effectivePlan,
      status,
      priceCents: effectivePlan === "FREE" ? 0 : PLAN_PRICE_CENTS[effectivePlan],
      currency: (subscription.currency ?? "eur").toUpperCase(),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      externalCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      externalSubscriptionId: subscription.id,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
    update: {
      plan: effectivePlan,
      status,
      priceCents: effectivePlan === "FREE" ? 0 : PLAN_PRICE_CENTS[effectivePlan],
      currency: (subscription.currency ?? "eur").toUpperCase(),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      externalCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      externalSubscriptionId: subscription.id,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      action: "billing.subscription_updated",
      entityType: "subscription",
      entityId: subscription.id,
      meta: { plan: effectivePlan, status, source: "stripe_webhook" },
    },
  });
}

export async function POST(request: Request) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "Stripe не налаштовано" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET не задано — подію відхилено");
    return NextResponse.json({ error: "Вебхук не налаштовано" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Немає підпису" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    // Невалідний підпис — це або чужий запит, або розсинхрон секрету.
    console.error("[stripe] підпис не пройшов перевірку", error);
    return NextResponse.json({ error: "Невірний підпис" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          // Checkout не завжди переносить metadata на підписку — доклеюємо
          // organizationId із сесії, інакше платіж не знайде свою організацію.
          if (!subscription.metadata?.organizationId && session.client_reference_id) {
            subscription.metadata = {
              ...subscription.metadata,
              organizationId: session.client_reference_id,
            };
          }
          await applySubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object);
        break;
      }

      default:
        // Решта подій нас не стосується — але відповідаємо 200,
        // інакше Stripe вважатиме доставку невдалою й почне ретраї.
        break;
    }
  } catch (error) {
    console.error("[stripe] помилка обробки події", event.type, error);
    // 500 змусить Stripe повторити доставку — це те, що треба
    // при тимчасовому збої бази.
    return NextResponse.json({ error: "Помилка обробки" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

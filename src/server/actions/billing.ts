"use server";

import { headers } from "next/headers";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { getStripe, priceIdFor, stripeEnabled } from "@/lib/billing/stripe";

/** Базова адреса для повернення зі Stripe. */
async function appUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  // Резерв на випадок, коли змінну забули задати: беремо з заголовків запиту,
  // інакше користувач після оплати повернувся б на localhost.
  const h = await headers();
  const host = h.get("host");
  return host ? `https://${host}` : "";
}

/**
 * Починає оплату: створює Stripe Checkout-сесію й повертає посилання.
 * Дані картки вводяться на боці Stripe — вони ніколи не проходять через
 * наш сервер, тож і зобов'язань PCI на застосунку немає.
 */
export async function startCheckoutAction(plan: string): Promise<ActionResult<{ url: string }>> {
  try {
    const ctx = await requirePermission("billing.manage");
    if (!stripeEnabled()) {
      return fail("Онлайн-оплата ще не підключена. Зверніться до нас — активуємо тариф вручну.");
    }

    const priceId = priceIdFor(plan as Plan);
    if (!priceId) return fail("Для цього тарифу не налаштовано ціну у Stripe");

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organization.id },
      select: { id: true, name: true, email: true, subscription: true },
    });

    const stripe = getStripe();
    const base = await appUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Прив'язуємо до наявного покупця, якщо він уже є: інакше в Stripe
      // на кожну оплату з'являвся б новий клієнт із власною історією.
      ...(organization.subscription?.externalCustomerId
        ? { customer: organization.subscription.externalCustomerId }
        : { customer_email: organization.email ?? ctx.user.email }),
      // organizationId — єдине, що зв'язує подію вебхука з нашою базою.
      client_reference_id: organization.id,
      subscription_data: { metadata: { organizationId: organization.id } },
      metadata: { organizationId: organization.id },
      success_url: `${base}/settings/billing?checkout=success`,
      cancel_url: `${base}/settings/billing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) return fail("Stripe не повернув посилання на оплату");

    await audit({
      organizationId: organization.id,
      userId: ctx.user.id,
      action: "billing.checkout_started",
      meta: { plan },
    });

    return ok({ url: session.url });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Відкриває кабінет Stripe: зміна картки, рахунки, скасування підписки.
 * Робити це в себе означало б відтворювати те, що провайдер уже вміє.
 */
export async function openBillingPortalAction(): Promise<ActionResult<{ url: string }>> {
  try {
    const ctx = await requirePermission("billing.manage");
    if (!stripeEnabled()) return fail("Онлайн-оплата ще не підключена");

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: ctx.organization.id },
      select: { externalCustomerId: true },
    });
    if (!subscription?.externalCustomerId) {
      return fail("Спочатку оформіть підписку — тоді з'явиться кабінет оплати");
    }

    const stripe = getStripe();
    const base = await appUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.externalCustomerId,
      return_url: `${base}/settings/billing`,
    });

    return ok({ url: session.url });
  } catch (error) {
    return toActionError(error);
  }
}

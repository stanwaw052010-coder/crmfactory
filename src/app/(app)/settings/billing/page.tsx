import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { stripeEnabled } from "@/lib/billing/stripe";
import { BillingPlans } from "@/features/settings/billing-plans";

export const metadata: Metadata = { title: "Тариф" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ctx = await requireViewPermission("billing.manage");

  const [subscription, employees, clients, appointments] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } }),
    prisma.employee.count({ where: { organizationId: ctx.organization.id, isActive: true } }),
    prisma.client.count({ where: { organizationId: ctx.organization.id } }),
    prisma.appointment.count({ where: { organizationId: ctx.organization.id } }),
  ]);

  const checkout = params.checkout;
  const checkoutResult =
    checkout === "success" ? "success" : checkout === "cancelled" ? "cancelled" : null;

  return (
    <BillingPlans
      plan={subscription?.plan ?? "FREE"}
      status={subscription?.status ?? "TRIALING"}
      trialEndsAt={subscription?.trialEndsAt?.toISOString() ?? null}
      currentPeriodEnd={subscription?.currentPeriodEnd?.toISOString() ?? null}
      cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
      hasPaymentAccount={Boolean(subscription?.externalCustomerId)}
      paymentsEnabled={stripeEnabled()}
      usage={{ employees, clients, appointments }}
      checkoutResult={checkoutResult}
    />
  );
}

import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { BillingPlans } from "@/features/settings/billing-plans";

export const metadata: Metadata = { title: "Тариф" };

export default async function BillingPage() {
  const ctx = await requireViewPermission("billing.manage");

  const [subscription, counts] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } }),
    Promise.all([
      prisma.employee.count({ where: { organizationId: ctx.organization.id } }),
      prisma.client.count({ where: { organizationId: ctx.organization.id } }),
      prisma.appointment.count({ where: { organizationId: ctx.organization.id } }),
    ]),
  ]);

  return (
    <BillingPlans
      plan={subscription?.plan ?? "FREE"}
      status={subscription?.status ?? "TRIALING"}
      trialEndsAt={subscription?.trialEndsAt?.toISOString() ?? null}
      currentPeriodEnd={subscription?.currentPeriodEnd?.toISOString() ?? null}
      usage={{ employees: counts[0], clients: counts[1], appointments: counts[2] }}
    />
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Logo } from "@/components/shared/logo";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { skipOnboardingAction } from "@/server/actions/onboarding";

export const metadata: Metadata = { title: "Налаштування workspace" };

export default async function OnboardingPage() {
  const ctx = await requireAuth();
  if (ctx.organization.onboardingCompleted) redirect("/dashboard");

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organization.id },
    select: { name: true, slug: true },
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] px-5 py-10">
      <div className="mx-auto mb-10 flex max-w-[680px] items-center justify-between">
        <Logo />
        <form action={skipOnboardingAction}>
          <button
            type="submit"
            className="text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
          >
            Пропустити
          </button>
        </form>
      </div>

      <OnboardingWizard
        organizationName={organization.name}
        userName={ctx.user.name}
        defaultSlug={organization.slug}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
      />
    </div>
  );
}

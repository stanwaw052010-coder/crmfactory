import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { Logo } from "@/components/shared/logo";
import { WorkspaceForm } from "@/features/settings/workspace-form";

export const metadata: Metadata = { title: "Новий workspace" };

export default async function NewWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link href="/dashboard" className="mb-8">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-[420px]">
        <h1 className="text-center text-[24px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
          Створити новий workspace
        </h1>
        <p className="mt-2 text-center text-[14px] text-[var(--fg-muted)]">
          Окремий бізнес — окремі клієнти, команда та статистика.
        </p>
        <div className="mt-8">
          <WorkspaceForm />
        </div>
        <p className="mt-6 text-center text-[13px] text-[var(--fg-muted)]">
          <Link href="/dashboard" className="font-medium text-[var(--primary)] hover:underline">
            Повернутися до CRM
          </Link>
        </p>
      </div>
    </div>
  );
}

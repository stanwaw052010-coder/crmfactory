import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/context";
import { recoveryEnabled } from "@/lib/auth/password-reset";
import { RecoveryForm } from "@/features/auth/recovery-form";

export const metadata: Metadata = { title: "Аварійний доступ", robots: { index: false } };

export default async function RecoveryPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  // Без ADMIN_RECOVERY_KEY сторінка не існує — жодних натяків на її наявність.
  if (!recoveryEnabled()) redirect("/login");

  return (
    <div className="animate-fade-up">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
        <ShieldAlert className="h-5.5 w-5.5" />
      </span>
      <h1 className="mt-5 text-[26px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
        Аварійний доступ
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
        Відновлення пароля власника платформи за ключем зі змінних середовища — на випадок,
        коли пошта ще не налаштована.
      </p>

      <div className="mt-8">
        <RecoveryForm />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-[var(--fg-muted)]">
        Звичайний акаунт?{" "}
        <Link href="/forgot-password" className="font-medium text-[var(--primary)] hover:underline">
          Відновити через пошту
        </Link>
      </p>
    </div>
  );
}

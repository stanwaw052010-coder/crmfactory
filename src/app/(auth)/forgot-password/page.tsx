import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/context";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Відновлення пароля" };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="animate-fade-up">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
        Забули пароль?
      </h1>
      <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
        Введіть email — надішлемо посилання для створення нового пароля.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13.5px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Повернутися до входу
        </Link>
      </p>
    </div>
  );
}

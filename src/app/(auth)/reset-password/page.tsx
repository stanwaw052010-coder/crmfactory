import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/context";
import { findValidResetToken } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Новий пароль" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { token } = await searchParams;
  // Токен перевіряємо ще до рендеру форми — не варто пропонувати
  // придумати пароль, щоб потім сказати «посилання мертве».
  const lookup = token ? await findValidResetToken(token) : { valid: false as const };

  if (!lookup.valid) {
    return (
      <div className="animate-fade-up text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
          <LinkIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-[22px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
          Посилання більше не дійсне
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
          Посилання живе 60 хвилин і спрацьовує один раз. Запросіть нове — це займе хвилину.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-[var(--primary)] px-5 text-[14px] font-medium text-[var(--primary-fg)] transition-transform duration-150 hover:-translate-y-px active:translate-y-0"
        >
          Надіслати нове посилання
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
        Новий пароль
      </h1>
      <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
        Для акаунта{" "}
        <span className="font-medium text-[var(--fg)]">{lookup.email}</span>. Після збереження
        всі активні сесії буде завершено.
      </p>

      <div className="mt-8">
        <ResetPasswordForm token={token as string} />
      </div>
    </div>
  );
}

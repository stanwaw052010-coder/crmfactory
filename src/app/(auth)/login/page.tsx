import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Вхід" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
        З поверненням 👋
      </h1>
      <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
        Увійдіть, щоб керувати записами та клієнтами.
      </p>

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-[var(--fg-muted)]">
        Ще немає акаунта?{" "}
        <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">
          Створити workspace
        </Link>
      </p>
    </div>
  );
}

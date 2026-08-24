import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Вхід" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { reset } = await searchParams;

  return (
    <div className="animate-fade-up">
      <h1 className="text-[27px] leading-tight font-semibold tracking-[-0.03em] text-[var(--fg)]">
        З поверненням
      </h1>
      <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
        Ваш салон уже чекає — записи, клієнти й каса на місці.
      </p>

      <div className="mt-8">
        <LoginForm resetDone={reset === "1"} />
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

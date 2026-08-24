import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Створити workspace" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
        Create your workspace
      </h1>
      <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
        Кілька полів — і ваша CRM готова до роботи.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-[var(--fg-muted)]">
        Вже маєте акаунт?{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
          Увійти
        </Link>
      </p>
    </div>
  );
}

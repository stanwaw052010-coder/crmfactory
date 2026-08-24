"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { requestPasswordResetAction } from "@/server/actions/password-reset";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, null);

  // Успіх — це «ми зробили все, що могли», а не «такий email існує».
  if (state?.ok) {
    return (
      <div className="animate-scale-in space-y-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
          <MailCheck className="h-7 w-7" />
        </span>
        <div className="space-y-2">
          <p className="text-[15px] font-medium text-[var(--fg)]">Перевірте пошту</p>
          <p className="text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
            Якщо такий акаунт існує, ми надіслали на нього посилання для зміни пароля. Воно
            дійсне 60 хвилин.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Повернутися до входу
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <div className="animate-scale-in flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Field
        label="Email"
        htmlFor="email"
        error={state && !state.ok ? state.fieldErrors?.email : undefined}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@company.com"
        />
      </Field>

      <SubmitButton size="lg" className="w-full">
        Надіслати посилання
      </SubmitButton>
    </form>
  );
}

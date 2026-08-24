"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ resetDone = false }: { resetDone?: boolean }) {
  const [state, formAction] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {resetDone && !state && (
        <div className="animate-scale-in flex items-start gap-2.5 rounded-xl border border-[var(--success)]/25 bg-[var(--success-soft)] px-3.5 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
          <p className="text-[13px] text-[var(--success)]">
            Пароль змінено. Увійдіть із новим паролем.
          </p>
        </div>
      )}

      {state && !state.ok && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Field label="Email" htmlFor="email" error={state && !state.ok ? state.fieldErrors?.email : undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </Field>

      <Field
        label="Пароль"
        htmlFor="password"
        error={state && !state.ok ? state.fieldErrors?.password : undefined}
        action={
          <Link
            href="/forgot-password"
            className="text-[12.5px] font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--primary)]"
          >
            Забули пароль?
          </Link>
        }
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Приховати пароль" : "Показати пароль"}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)]"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <SubmitButton size="lg" className="w-full">
        Увійти
      </SubmitButton>
    </form>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordStrength } from "@/features/auth/password-strength";
import { recoverAdminAction } from "@/server/actions/password-reset";

export function RecoveryForm() {
  const [state, formAction] = useActionState(recoverAdminAction, null);
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <div className="animate-scale-in flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Field label="Email супер-адміна" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@crm.factory"
        />
      </Field>

      <Field
        label="Ключ відновлення"
        htmlFor="key"
        hint="ADMIN_RECOVERY_KEY"
      >
        <div className="relative">
          <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <Input
            id="key"
            name="key"
            type="password"
            autoComplete="off"
            required
            placeholder="••••••••••••"
            className="pl-9"
          />
        </div>
      </Field>

      <div className="h-px bg-[var(--border)]" />

      <Field label="Новий пароль" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder="••••••••"
            className="pr-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Приховати пароль" : "Показати пароль"}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)]"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <PasswordStrength value={password} />

      <Field
        label="Повторіть пароль"
        htmlFor="confirmPassword"
        error={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton size="lg" className="w-full">
        Відновити доступ
      </SubmitButton>
    </form>
  );
}

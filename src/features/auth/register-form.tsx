"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { registerAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const RULES = [
  { test: (v: string) => v.length >= 8, label: "8+ символів" },
  { test: (v: string) => /[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(v), label: "літера" },
  { test: (v: string) => /\d/.test(v), label: "цифра" },
];

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && !state.fieldErrors && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Field label="Назва бізнесу" htmlFor="businessName" error={errors?.businessName}>
        <Input id="businessName" name="businessName" required placeholder="Luna Beauty Studio" />
      </Field>

      <Field label="Ваше ім'я" htmlFor="name" error={errors?.name}>
        <Input id="name" name="name" required autoComplete="name" placeholder="Демид" />
      </Field>

      <Field label="Email" htmlFor="email" error={errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Пароль" htmlFor="password" error={errors?.password}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      <div className="flex flex-wrap gap-2">
        {RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <span
              key={rule.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium transition-colors",
                passed
                  ? "bg-[var(--success-soft)] text-[var(--success)]"
                  : "bg-[var(--surface-hover)] text-[var(--fg-subtle)]",
              )}
            >
              {passed && <Check className="h-3 w-3" />}
              {rule.label}
            </span>
          );
        })}
      </div>

      <SubmitButton size="lg" className="w-full">
        Створити workspace
      </SubmitButton>

      <p className="text-center text-[12px] leading-relaxed text-[var(--fg-subtle)]">
        Створюючи акаунт, ви погоджуєтесь з умовами використання crm.factory.
      </p>
    </form>
  );
}

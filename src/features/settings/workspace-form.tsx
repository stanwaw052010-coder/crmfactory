"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { createWorkspaceAction } from "@/server/actions/onboarding";

export function WorkspaceForm() {
  const [state, formAction] = useActionState(createWorkspaceAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && !state.fieldErrors && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}
      <Field
        label="Назва бізнесу"
        error={state && !state.ok ? state.fieldErrors?.name : undefined}
      >
        <Input name="name" required autoFocus placeholder="Luna Beauty Studio" />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Створити workspace
      </SubmitButton>
    </form>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Send, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { sendTestEmailAction } from "@/server/actions/admin";

export type MailStatusProps = {
  configured: boolean;
  from: string;
  sandboxSender: boolean;
  senderValid: boolean;
  senderDomain: string | null;
  defaultTo: string;
};

export function MailStatusCard({
  configured,
  from,
  sandboxSender,
  senderValid,
  senderDomain,
  defaultTo,
}: MailStatusProps) {
  const [state, formAction] = useActionState(sendTestEmailAction, null);

  // Порядок важливий: зламану адресу відправника показуємо раніше за
  // все інше — з нею не спрацює навіть правильно налаштований ключ.
  const level = !senderValid ? "broken" : !configured ? "off" : sandboxSender ? "sandbox" : "ok";

  const tone =
    level === "ok"
      ? { border: "var(--success)", bg: "var(--success-soft)", fg: "var(--success)" }
      : level === "sandbox"
        ? { border: "var(--warning)", bg: "var(--warning-soft)", fg: "var(--warning)" }
        : { border: "var(--danger)", bg: "var(--danger-soft)", fg: "var(--danger)" };

  const StatusIcon =
    level === "ok" ? CheckCircle2 : level === "sandbox" ? TriangleAlert : AlertTriangle;

  return (
    <Card>
      <CardHeader
        title="Пошта"
        description="Відновлення пароля та сповіщення клієнтам"
        action={<Mail className="h-4 w-4 text-[var(--fg-subtle)]" />}
      />
      <CardBody className="space-y-4">
        <div
          className="flex items-start gap-2.5 rounded-xl border px-3.5 py-3"
          style={{ borderColor: `color-mix(in oklab, ${tone.border} 30%, transparent)`, background: tone.bg }}
        >
          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tone.fg }} />
          <div className="min-w-0 space-y-1">
            {level === "broken" ? (
              <>
                <p className="text-[13px] font-medium" style={{ color: tone.fg }}>
                  Адреса відправника некоректна
                </p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: tone.fg }}>
                  У <code className="font-mono">MAIL_FROM</code> зараз{" "}
                  <code className="font-mono">{from}</code>. Потрібен формат{" "}
                  <code className="font-mono">Назва &lt;email@ваш-домен.com&gt;</code> — з повним
                  доменом, який підтверджено в Resend. Жоден лист із такою адресою не піде.
                </p>
              </>
            ) : level === "off" ? (
              <>
                <p className="text-[13px] font-medium" style={{ color: tone.fg }}>
                  Листи не відправляються
                </p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: tone.fg }}>
                  Змінна <code className="font-mono">RESEND_API_KEY</code> не задана. Посилання
                  на відновлення пароля друкуються в лог сервера — клієнт їх не отримає.
                </p>
              </>
            ) : level === "sandbox" ? (
              <>
                <p className="text-[13px] font-medium" style={{ color: tone.fg }}>
                  Тестовий відправник
                </p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: tone.fg }}>
                  Адреса <code className="font-mono">{from}</code> — пісочниця Resend: листи
                  дійдуть лише на ваш власний email. Щоб писати клієнтам, підтвердіть свій
                  домен у Resend і вкажіть його в <code className="font-mono">MAIL_FROM</code>.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium" style={{ color: tone.fg }}>
                  Пошта налаштована
                </p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: tone.fg }}>
                  Відправник: <code className="font-mono">{from}</code>
                  {senderDomain && (
                    <>
                      {" "}
                      — домен <code className="font-mono">{senderDomain}</code> має бути
                      підтверджений у Resend.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <form action={formAction} className="space-y-3">
          <Field label="Надіслати тестовий лист" htmlFor="test-to">
            <div className="flex gap-2">
              <Input
                id="test-to"
                name="to"
                type="email"
                required
                defaultValue={defaultTo}
                placeholder="you@company.com"
              />
              <SubmitButton variant="secondary" className="shrink-0">
                <Send className="h-4 w-4" />
                Перевірити
              </SubmitButton>
            </div>
          </Field>

          {state && !state.ok && (
            <p className="animate-fade-up rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--danger)]">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="animate-fade-up rounded-lg bg-[var(--success-soft)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--success)]">
              {state.data.message}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

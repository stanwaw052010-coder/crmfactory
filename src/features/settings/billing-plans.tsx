"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatDateUk } from "@/lib/time";
import {
  PLAN_FEATURES,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_ORDER,
  PLAN_PRICE_CENTS,
  PLAN_TAGLINES,
} from "@/lib/plans";
import { openBillingPortalAction, startCheckoutAction } from "@/server/actions/billing";
import type { Plan } from "@prisma/client";

export function BillingPlans({
  plan,
  status,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  hasPaymentAccount,
  paymentsEnabled,
  usage,
  checkoutResult,
}: {
  plan: Plan;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasPaymentAccount: boolean;
  paymentsEnabled: boolean;
  usage: { employees: number; clients: number; appointments: number };
  checkoutResult: "success" | "cancelled" | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);

  // Повернення з Stripe. Успіх тут — лише сигнал «оплату завершено в браузері»:
  // сам тариф змінює вебхук, тому оновлюємо дані, а не малюємо новий план.
  const [seenResult, setSeenResult] = React.useState(checkoutResult);
  if (seenResult !== checkoutResult) {
    setSeenResult(checkoutResult);
    if (checkoutResult === "success") {
      toast.success("Оплату прийнято", "Тариф оновиться протягом кількох секунд");
      setTimeout(() => router.refresh(), 2500);
    } else if (checkoutResult === "cancelled") {
      toast.info("Оплату скасовано", "Тариф лишився без змін");
    }
  }

  const checkout = async (target: Plan) => {
    setPending(target);
    const result = await startCheckoutAction(target);
    setPending(null);
    if (result.ok) {
      window.location.assign(result.data.url);
    } else {
      toast.error("Не вдалося перейти до оплати", result.error);
    }
  };

  const openPortal = async () => {
    setPending("portal");
    const result = await openBillingPortalAction();
    setPending(null);
    if (result.ok) {
      window.location.assign(result.data.url);
    } else {
      toast.error("Не вдалося відкрити кабінет оплати", result.error);
    }
  };

  const limits = PLAN_LIMITS[plan];
  const overLimit = limits.employees !== null && usage.employees > limits.employees;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Поточний тариф"
          action={
            hasPaymentAccount && paymentsEnabled ? (
              <Button
                variant="secondary"
                size="sm"
                loading={pending === "portal"}
                onClick={openPortal}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Картка й рахунки
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="flex items-center gap-2 text-[16px] font-semibold text-[var(--fg)]">
                  {PLAN_LABELS[plan]}
                  <Badge tone={status === "ACTIVE" ? "success" : status === "PAST_DUE" ? "danger" : "info"}>
                    {status}
                  </Badge>
                </p>
                <p className="text-[12.5px] text-[var(--fg-muted)]">
                  {cancelAtPeriodEnd && currentPeriodEnd
                    ? `Підписку скасовано, доступ до ${formatDateUk(new Date(currentPeriodEnd))}`
                    : status === "TRIALING" && trialEndsAt
                      ? `Безкоштовний доступ до ${formatDateUk(new Date(trialEndsAt))}`
                      : currentPeriodEnd
                        ? `Наступне списання ${formatDateUk(new Date(currentPeriodEnd))}`
                        : "Без обмежень у часі"}
                </p>
              </div>
            </div>

            <div className="ml-auto grid grid-cols-3 gap-6">
              <Usage
                label="Співробітників"
                value={usage.employees}
                limit={limits.employees}
                warn={overLimit}
              />
              <Usage label="Клієнтів" value={usage.clients} limit={null} />
              <Usage label="Записів" value={usage.appointments} limit={null} />
            </div>
          </div>

          {overLimit && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <p className="text-[13px] text-[var(--fg)]">
                Активних співробітників більше, ніж дозволяє тариф. Наявні профілі й записи
                працюють, але додати нових не вийде — оберіть вищий тариф.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((item) => {
          const current = item === plan;
          const highlight = item === "BUSINESS";
          const price = PLAN_PRICE_CENTS[item];

          return (
            <div
              key={item}
              className={cn(
                "card relative flex flex-col p-5",
                highlight && !current && "ring-2 ring-[var(--primary)]",
                current && "ring-2 ring-[var(--success)]",
              )}
            >
              {highlight && !current && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Популярний
                </span>
              )}
              {current && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-[var(--success)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Ваш тариф
                </span>
              )}

              <p className="text-[15px] font-semibold text-[var(--fg)]">{PLAN_LABELS[item]}</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">{PLAN_TAGLINES[item]}</p>
              <p className="mt-4 text-[28px] leading-none font-semibold text-[var(--fg)]">
                {price === 0 ? "€0" : formatMoney(price, "EUR")}
                <span className="text-[13px] font-normal text-[var(--fg-subtle)]">/міс</span>
              </p>

              <ul className="mt-4 flex-1 space-y-2">
                {PLAN_FEATURES[item].map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-[12.5px] text-[var(--fg-muted)]"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5 w-full"
                variant={current ? "secondary" : highlight ? "primary" : "outline"}
                disabled={current || item === "FREE"}
                loading={pending === item}
                onClick={() => checkout(item)}
              >
                {current ? "Поточний тариф" : item === "FREE" ? "Базовий" : "Обрати"}
              </Button>
            </div>
          );
        })}
      </div>

      {!paymentsEnabled && (
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
                <strong className="text-[var(--fg)]">Онлайн-оплату ще не підключено.</strong>{" "}
                Тарифи працюють, але оформити підписку карткою поки не можна — тариф
                активується вручну. Щоб увімкнути оплату, додайте ключі Stripe у змінні
                середовища (див. <code>.env.example</code>).
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {paymentsEnabled && (
        <Card>
          <CardBody>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Оплата проходить на боці Stripe — дані картки не потрапляють на наш сервер.
              Змінити картку, завантажити рахунки або скасувати підписку можна кнопкою
              «Картка й рахунки».
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Usage({
  label,
  value,
  limit,
  warn,
}: {
  label: string;
  value: number;
  limit: number | null;
  warn?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-[18px] font-semibold tabular-nums",
          warn ? "text-[var(--warning)]" : "text-[var(--fg)]",
        )}
      >
        {value}
        {limit !== null && (
          <span className="text-[13px] font-normal text-[var(--fg-subtle)]"> / {limit}</span>
        )}
      </p>
      <p className="text-[11.5px] text-[var(--fg-subtle)]">{label}</p>
    </div>
  );
}

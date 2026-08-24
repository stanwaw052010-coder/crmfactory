"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDateUk } from "@/lib/time";
import { changePlanAction } from "@/server/actions/settings";
import type { Plan } from "@prisma/client";

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "FREE",
    name: "Free",
    price: "€0",
    tagline: "Щоб спробувати",
    features: ["1 співробітник", "До 50 клієнтів", "Календар і записи", "Онлайн-запис"],
  },
  {
    id: "STARTER",
    name: "Starter",
    price: "€19",
    tagline: "Для невеликої студії",
    features: ["До 3 співробітників", "Необмежені клієнти", "Воронка продажів", "Базова аналітика"],
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: "€39",
    tagline: "Для команди, що росте",
    features: [
      "До 10 співробітників",
      "Повна аналітика",
      "Ролі та права доступу",
      "Нагадування клієнтам",
    ],
    highlight: true,
  },
  {
    id: "PRO",
    name: "Pro",
    price: "€79",
    tagline: "Для мережі",
    features: [
      "Необмежена команда",
      "Кілька workspace",
      "Пріоритетна підтримка",
      "Експорт та API (скоро)",
    ],
  },
];

export function BillingPlans({
  plan,
  status,
  trialEndsAt,
  currentPeriodEnd,
  usage,
}: {
  plan: Plan;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  usage: { employees: number; clients: number; appointments: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<Plan | null>(null);

  const change = async (next: Plan) => {
    setPending(next);
    const result = await changePlanAction(next);
    setPending(null);
    if (result.ok) {
      toast.success(`Тариф змінено на ${next}`, "Оплата підключиться на наступному етапі");
      router.refresh();
    } else {
      toast.error("Не вдалося змінити тариф", result.error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Поточний тариф" />
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="flex items-center gap-2 text-[16px] font-semibold text-[var(--fg)]">
                  {PLANS.find((p) => p.id === plan)?.name ?? plan}
                  <Badge tone={status === "ACTIVE" ? "success" : "info"}>{status}</Badge>
                </p>
                <p className="text-[12.5px] text-[var(--fg-muted)]">
                  {status === "TRIALING" && trialEndsAt
                    ? `Пробний період до ${formatDateUk(new Date(trialEndsAt))}`
                    : currentPeriodEnd
                      ? `Наступне списання ${formatDateUk(new Date(currentPeriodEnd))}`
                      : "Без обмежень у часі"}
                </p>
              </div>
            </div>

            <div className="ml-auto grid grid-cols-3 gap-6">
              <Usage label="Співробітників" value={usage.employees} />
              <Usage label="Клієнтів" value={usage.clients} />
              <Usage label="Записів" value={usage.appointments} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((item) => {
          const current = item.id === plan;
          return (
            <div
              key={item.id}
              className={cn(
                "card relative flex flex-col p-5",
                item.highlight && "ring-2 ring-[var(--primary)]",
              )}
            >
              {item.highlight && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Популярний
                </span>
              )}
              <p className="text-[15px] font-semibold text-[var(--fg)]">{item.name}</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">{item.tagline}</p>
              <p className="mt-4 text-[28px] leading-none font-semibold text-[var(--fg)]">
                {item.price}
                <span className="text-[13px] font-normal text-[var(--fg-subtle)]">/міс</span>
              </p>

              <ul className="mt-4 flex-1 space-y-2">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[12.5px] text-[var(--fg-muted)]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5 w-full"
                variant={current ? "secondary" : item.highlight ? "primary" : "outline"}
                disabled={current}
                loading={pending === item.id}
                onClick={() => change(item.id)}
              >
                {current ? "Поточний тариф" : "Обрати"}
              </Button>
            </div>
          );
        })}
      </div>

      <Card>
        <CardBody>
          <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
            <strong className="text-[var(--fg)]">Про оплату.</strong> Зараз зміна тарифу зберігається
            в підписці організації без списання коштів. Модель уже містить поля для зовнішнього
            провайдера (<code>externalCustomerId</code>, <code>externalSubscriptionId</code>,
            період підписки), тож підключення Stripe Checkout і вебхуків не потребуватиме
            переписування застосунку.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Usage({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[18px] font-semibold text-[var(--fg)] tabular-nums">{value}</p>
      <p className="text-[11.5px] text-[var(--fg-subtle)]">{label}</p>
    </div>
  );
}

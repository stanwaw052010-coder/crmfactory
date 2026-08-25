"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, HeartHandshake, MessageCircle, Phone } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn, pluralUk } from "@/lib/utils";
import { RISK_LABELS, type RiskLevel } from "@/lib/churn";
import type { FollowUp } from "@/server/queries/follow-ups";

const LEVEL_TONE: Record<RiskLevel, { fg: string; bg: string }> = {
  watch: { fg: "var(--info)", bg: "var(--info-soft)" },
  risk: { fg: "var(--warning)", bg: "var(--warning-soft)" },
  lost: { fg: "var(--danger)", bg: "var(--danger-soft)" },
};

/**
 * Список клієнтів, яких варто повернути.
 *
 * Поруч із кожним — готовий текст. Це шаблон, а не згенерований лист:
 * власниця салону надсилає його від свого імені й має бачити наперед,
 * що саме піде клієнту.
 */
export function FollowUps({ items }: { items: FollowUp[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Варто нагадати про себе"
        description={
          items.length > 0
            ? `${items.length} ${pluralUk(items.length, "клієнт", "клієнти", "клієнтів")} затримуються довше за свій звичний ритм`
            : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={HeartHandshake}
          title="Усі повертаються вчасно"
          description="Ніхто з клієнтів не затримується довше за свій звичний інтервал між візитами."
        />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <FollowUpRow key={item.clientId} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function FollowUpRow({ item }: { item: FollowUp }) {
  const [copied, setCopied] = React.useState(false);
  const tone = LEVEL_TONE[item.level];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Буфер недоступний — текст усе одно видно на екрані. */
    }
  };

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clients/${item.clientId}`}
              className="truncate text-[14px] font-medium text-[var(--fg)] hover:text-[var(--primary)]"
            >
              {item.firstName} {item.lastName ?? ""}
            </Link>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {RISK_LABELS[item.level]}
            </span>
          </div>

          {/* Головне пояснення: не просто «давно не був», а наскільки це
              незвично саме для нього. */}
          <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">
            Не був {item.sinceDays} {pluralUk(item.sinceDays, "день", "дні", "днів")}, а
            зазвичай приходить раз на {item.intervalDays}{" "}
            {pluralUk(item.intervalDays, "день", "дні", "днів")}
            {item.favouriteService && ` · ${item.favouriteService}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {item.phone && (
            <a href={`tel:${item.phone}`} aria-label={`Подзвонити ${item.firstName}`}>
              <Button variant="secondary" size="icon-sm">
                <Phone className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
          <Button
            variant={copied ? "success" : "secondary"}
            size="sm"
            onClick={copy}
            className="gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Скопійовано" : "Текст"}</span>
          </Button>
        </div>
      </div>

      <details className="group mt-2">
        <summary
          className={cn(
            "cursor-pointer list-none text-[11.5px] text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg-muted)]",
            "marker:hidden",
          )}
        >
          <span className="group-open:hidden">Показати текст повідомлення</span>
          <span className="hidden group-open:inline">Сховати текст</span>
        </summary>
        <div className="animate-fade-up mt-2 flex items-start gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            {item.message}
          </p>
          <button
            type="button"
            onClick={copy}
            aria-label="Скопіювати"
            className="shrink-0 rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)]"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </details>
    </li>
  );
}

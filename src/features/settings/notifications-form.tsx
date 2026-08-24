"use client";

import * as React from "react";
import { useActionState } from "react";
import { Bell, Clock, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Switch } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updateNotificationSettingsAction } from "@/server/actions/settings";
import type { ReminderChannel } from "@prisma/client";

const CHANNELS: {
  value: ReminderChannel;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
}[] = [
  {
    value: "IN_APP",
    label: "У застосунку",
    description: "Нагадування з'являється у дзвіночку CRM",
    icon: Bell,
    ready: true,
  },
  {
    value: "EMAIL",
    label: "Email",
    description: "Потрібен ключ поштового провайдера в .env",
    icon: Mail,
    ready: false,
  },
  {
    value: "TELEGRAM",
    label: "Telegram",
    description: "Потрібен бот-токен у .env",
    icon: Send,
    ready: false,
  },
  {
    value: "SMS",
    label: "SMS",
    description: "Потрібні дані SMS-провайдера в .env",
    icon: Smartphone,
    ready: false,
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp",
    description: "Потрібен доступ до WhatsApp Business API",
    icon: MessageCircle,
    ready: false,
  },
];

export function NotificationsForm({
  settings,
  pendingReminders,
}: {
  settings: { reminderEnabled: boolean; reminderHoursBefore: number; channels: ReminderChannel[] };
  pendingReminders: number;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(updateNotificationSettingsAction, null);
  const [enabled, setEnabled] = React.useState(settings.reminderEnabled);
  const [channels, setChannels] = React.useState<ReminderChannel[]>(settings.channels);

  React.useEffect(() => {
    if (state?.ok) toast.success("Налаштування сповіщень збережено");
    else if (state && !state.ok) toast.error("Не вдалося зберегти", state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const toggle = (channel: ReminderChannel) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="reminderEnabled" value={enabled ? "on" : ""} />
      {channels.map((channel) => (
        <input key={channel} type="hidden" name="channels" value={channel} />
      ))}

      <Card>
        <CardHeader
          title="Нагадування клієнтам"
          description="Менше забутих візитів — менше втраченої виручки"
        />
        <CardBody className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              label="Надсилати нагадування"
              description="Створюються автоматично для кожного підтвердженого запису"
            />
          </div>

          <Field label="Коли нагадувати">
            <Select name="reminderHoursBefore" defaultValue={String(settings.reminderHoursBefore)}>
              {[1, 2, 3, 6, 12, 24, 48].map((hours) => (
                <option key={hours} value={hours}>
                  За {hours} {hours === 1 ? "годину" : hours < 5 ? "години" : "годин"} до візиту
                </option>
              ))}
            </Select>
          </Field>

          {pendingReminders > 0 && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
              <Clock className="h-3.5 w-3.5" />У черзі: <strong>{pendingReminders}</strong>{" "}
              нагадувань
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Канали доставки"
          description="Архітектура підтримує всі канали — активні ті, для яких налаштовано провайдера"
        />
        <CardBody className="space-y-2">
          {CHANNELS.map((channel) => {
            const active = channels.includes(channel.value);
            const Icon = channel.icon;
            return (
              <button
                key={channel.value}
                type="button"
                onClick={() => toggle(channel.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--fg-subtle)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-[var(--fg)]">
                      {channel.label}
                    </span>
                    {channel.ready ? (
                      <Badge tone="success" dot>
                        Працює
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Готово до підключення</Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-[var(--fg-muted)]">
                    {channel.description}
                  </span>
                </span>
              </button>
            );
          })}

          <p className="pt-2 text-[12.5px] leading-relaxed text-[var(--fg-subtle)]">
            Нагадування для неактивних каналів ставляться в чергу зі статусом «Очікує». Щойно ви
            додасте ключі провайдера у <code>.env</code>, воркер почне їх доставляти — код
            застосунку змінювати не потрібно.
          </p>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>Зберегти налаштування</SubmitButton>
      </div>
    </form>
  );
}

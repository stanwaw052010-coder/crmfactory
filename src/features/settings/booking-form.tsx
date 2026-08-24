"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Copy, ExternalLink, QrCode, Share2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { minutesToTime, timeToMinutes, WEEKDAYS_UK } from "@/lib/time";
import {
  updateBookingSettingsAction,
  updateBusinessHoursAction,
} from "@/server/actions/settings";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function BookingForm({
  organization,
  businessHours,
  appUrl,
  canManage,
}: {
  organization: {
    slug: string;
    bookingEnabled: boolean;
    bookingAutoConfirm: boolean;
    bookingLeadTimeMin: number;
    bookingHorizonDays: number;
    bookingCancelHours: number;
    bookingSlotStepMin: number;
    bookingRequireEmail: boolean;
    bookingWelcomeText: string | null;
  };
  businessHours: { weekday: number; openMinute: number; closeMinute: number; isClosed: boolean }[];
  appUrl: string;
  canManage: boolean;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(updateBookingSettingsAction, null);
  const [hoursState, hoursAction] = useActionState(updateBusinessHoursAction, null);

  const [slug, setSlug] = React.useState(organization.slug);
  const [enabled, setEnabled] = React.useState(organization.bookingEnabled);
  const [autoConfirm, setAutoConfirm] = React.useState(organization.bookingAutoConfirm);
  const [requireEmail, setRequireEmail] = React.useState(organization.bookingRequireEmail);
  const [copied, setCopied] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);

  const [hours, setHours] = React.useState(() =>
    Object.fromEntries(businessHours.map((h) => [h.weekday, h])),
  );

  const bookingUrl = `${appUrl}/book/${slug}`;

  React.useEffect(() => {
    if (state?.ok) toast.success("Налаштування збережено");
    else if (state && !state.ok) toast.error("Не вдалося зберегти", state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  React.useEffect(() => {
    if (hoursState?.ok) toast.success("Робочі години збережено");
    else if (hoursState && !hoursState.ok) toast.error("Не вдалося зберегти", hoursState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursState]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Посилання скопійовано");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не вдалося скопіювати", "Скопіюйте посилання вручну");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Онлайн-запис", url: bookingUrl });
      } catch {
        /* користувач скасував — це не помилка */
      }
    } else {
      void copy();
    }
  };

  return (
    <div className="space-y-6">
      {/* Посилання на сторінку запису */}
      <Card>
        <CardHeader
          title="Ваша сторінка запису"
          description="Поділіться посиланням у Instagram, Telegram чи Google — клієнти записуватимуться самі"
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <code className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--fg)]">
              {bookingUrl}
            </code>
            <div className="flex shrink-0 gap-1.5">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Скопійовано" : "Копіювати"}
              </Button>
              <Button variant="secondary" size="sm" onClick={share}>
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Поділитися</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setQrOpen(true)}>
                <QrCode className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">QR</span>
              </Button>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Відкрити</span>
                </Button>
              </a>
            </div>
          </div>
        </CardBody>
      </Card>

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="bookingEnabled" value={enabled ? "on" : ""} />
        <input type="hidden" name="bookingAutoConfirm" value={autoConfirm ? "on" : ""} />
        <input type="hidden" name="bookingRequireEmail" value={requireEmail ? "on" : ""} />

        <Card>
          <CardHeader title="Правила онлайн-запису" />
          <CardBody className="space-y-4">
            <Field
              label="Адреса сторінки"
              hint={`${appUrl}/book/`}
              error={state && !state.ok ? state.fieldErrors?.slug : undefined}
            >
              <Input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                disabled={!canManage}
                required
              />
            </Field>

            <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={!canManage}
                label="Онлайн-запис увімкнено"
                description="Вимкніть, щоб тимчасово закрити прийом заявок"
              />
              <div className="h-px bg-[var(--border)]" />
              <Switch
                checked={autoConfirm}
                onCheckedChange={setAutoConfirm}
                disabled={!canManage}
                label="Підтверджувати автоматично"
                description="Інакше запис отримає статус «Очікує» і його підтвердить адміністратор"
              />
              <div className="h-px bg-[var(--border)]" />
              <Switch
                checked={requireEmail}
                onCheckedChange={setRequireEmail}
                disabled={!canManage}
                label="Email обов'язковий"
                description="Знадобиться, коли підключите email-нагадування"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Записуватись не пізніше ніж за">
                <Select
                  name="bookingLeadTimeMin"
                  defaultValue={String(organization.bookingLeadTimeMin)}
                  disabled={!canManage}
                >
                  {[0, 30, 60, 120, 240, 720, 1440].map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? "Без обмежень" : value < 60 ? `${value} хв` : `${value / 60} год`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Показувати вільні дати на">
                <Select
                  name="bookingHorizonDays"
                  defaultValue={String(organization.bookingHorizonDays)}
                  disabled={!canManage}
                >
                  {[7, 14, 30, 60, 90].map((value) => (
                    <option key={value} value={value}>
                      {value} днів
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Крок слотів">
                <Select
                  name="bookingSlotStepMin"
                  defaultValue={String(organization.bookingSlotStepMin)}
                  disabled={!canManage}
                >
                  {[10, 15, 20, 30, 60].map((value) => (
                    <option key={value} value={value}>
                      {value} хв
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Скасування не пізніше ніж за">
                <Select
                  name="bookingCancelHours"
                  defaultValue={String(organization.bookingCancelHours)}
                  disabled={!canManage}
                >
                  {[0, 2, 6, 12, 24, 48].map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? "Будь-коли" : `${value} год`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Вітальний текст" hint="перше, що бачить клієнт">
              <Textarea
                name="bookingWelcomeText"
                defaultValue={organization.bookingWelcomeText ?? ""}
                rows={2}
                disabled={!canManage}
                placeholder="Оберіть послугу та зручний час — ми чекаємо на вас!"
              />
            </Field>
          </CardBody>
        </Card>

        {canManage && (
          <div className="flex justify-end">
            <SubmitButton>Зберегти налаштування</SubmitButton>
          </div>
        )}
      </form>

      <form action={hoursAction}>
        <Card>
          <CardHeader
            title="Робочі години бізнесу"
            description="Онлайн-запис ніколи не запропонує час поза цими межами"
          />
          <CardBody className="space-y-1">
            {WEEK_ORDER.map((weekday) => {
              const day = hours[weekday] ?? {
                weekday,
                openMinute: 540,
                closeMinute: 1080,
                isClosed: weekday === 0,
              };
              return (
                <div
                  key={weekday}
                  className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-hover)]"
                >
                  <input type="hidden" name={`day-${weekday}-closed`} value={day.isClosed ? "on" : ""} />
                  <input type="hidden" name={`day-${weekday}-open`} value={day.openMinute} />
                  <input type="hidden" name={`day-${weekday}-close`} value={day.closeMinute} />

                  <span className="w-24 shrink-0 text-[13.5px] font-medium text-[var(--fg)]">
                    {WEEKDAYS_UK[weekday]}
                  </span>
                  <Switch
                    checked={!day.isClosed}
                    disabled={!canManage}
                    onCheckedChange={(value) =>
                      setHours((prev) => ({
                        ...prev,
                        [weekday]: { ...day, isClosed: !value },
                      }))
                    }
                  />
                  {day.isClosed ? (
                    <span className="text-[13px] text-[var(--fg-subtle)]">Зачинено</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        disabled={!canManage}
                        value={minutesToTime(day.openMinute)}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [weekday]: { ...day, openMinute: timeToMinutes(e.target.value) },
                          }))
                        }
                        className="h-8 w-[104px] text-[13px]"
                      />
                      <span className="text-[var(--fg-subtle)]">—</span>
                      <Input
                        type="time"
                        step={900}
                        disabled={!canManage}
                        value={minutesToTime(day.closeMinute)}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [weekday]: { ...day, closeMinute: timeToMinutes(e.target.value) },
                          }))
                        }
                        className="h-8 w-[104px] text-[13px]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardBody>
          {canManage && (
            <div className="flex justify-end border-t border-[var(--border)] px-5 py-3.5">
              <SubmitButton size="sm">Зберегти години</SubmitButton>
            </div>
          )}
        </Card>
      </form>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} size="sm" title="QR-код для запису">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-2xl bg-white p-4">
            {/* QR генерується публічним сервісом лише на вимогу користувача */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(bookingUrl)}`}
              alt="QR-код сторінки онлайн-запису"
              width={240}
              height={240}
            />
          </div>
          <p className="text-center text-[13px] text-[var(--fg-muted)]">
            Роздрукуйте й розмістіть на ресепшені — клієнти зможуть записатись зі смартфона.
          </p>
          <code className="text-[12px] text-[var(--fg-subtle)]">{bookingUrl}</code>
        </div>
      </Modal>
    </div>
  );
}

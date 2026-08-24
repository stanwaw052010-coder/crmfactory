"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES, currencySymbol } from "@/lib/money";
import { updateOrganizationAction } from "@/server/actions/settings";

const TIMEZONES = [
  "Europe/Kyiv",
  "Europe/Warsaw",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Prague",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Bucharest",
];

const INDUSTRIES = [
  "Салон краси",
  "Барбершоп",
  "Нігтьова студія",
  "Масаж і СПА",
  "Стоматологія",
  "Медичний центр",
  "Фітнес / тренер",
  "Тату-студія",
  "Автосервіс",
  "Освіта / репетитор",
  "Інше",
];

export function BusinessForm({
  organization,
  canManage,
}: {
  organization: {
    name: string;
    industry: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    about: string | null;
    timezone: string;
    currency: string;
    brandColor: string;
    logoUrl: string | null;
  };
  canManage: boolean;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(updateOrganizationAction, null);

  React.useEffect(() => {
    if (state?.ok) toast.success("Налаштування збережено");
    else if (state && !state.ok) toast.error("Не вдалося зберегти", state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader title="Дані бізнесу" description="Показуються клієнтам на сторінці онлайн-запису" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Назва" error={errors?.name}>
              <Input name="name" defaultValue={organization.name} required disabled={!canManage} />
            </Field>
            <Field label="Сфера">
              <Select name="industry" defaultValue={organization.industry ?? ""} disabled={!canManage}>
                <option value="">Не вказано</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон" error={errors?.phone}>
              <Input name="phone" type="tel" defaultValue={organization.phone ?? ""} disabled={!canManage} />
            </Field>
            <Field label="Email" error={errors?.email}>
              <Input name="email" type="email" defaultValue={organization.email ?? ""} disabled={!canManage} />
            </Field>
          </div>

          <Field label="Адреса">
            <Input name="address" defaultValue={organization.address ?? ""} disabled={!canManage} placeholder="вул. Хрещатик, 1, Київ" />
          </Field>

          <Field label="Опис" hint="кілька речень для сторінки запису">
            <Textarea name="about" defaultValue={organization.about ?? ""} rows={3} disabled={!canManage} />
          </Field>

          <Field label="Логотип" hint="посилання на зображення">
            <Input name="logoUrl" defaultValue={organization.logoUrl ?? ""} disabled={!canManage} placeholder="https://…" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Регіональні налаштування" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Часовий пояс">
              <Select name="timezone" defaultValue={organization.timezone} disabled={!canManage}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Валюта">
              <Select name="currency" defaultValue={organization.currency} disabled={!canManage}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code} · {currencySymbol(code)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Фірмовий колір" hint="акцент на сторінці запису">
            <Input
              name="brandColor"
              type="color"
              defaultValue={organization.brandColor}
              className="h-10 w-24 p-1"
              disabled={!canManage}
            />
          </Field>
        </CardBody>
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <SubmitButton>Зберегти зміни</SubmitButton>
        </div>
      )}
    </form>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { CLIENT_STATUS_LABELS } from "@/components/shared/status";
import { createClientAction, updateClientAction } from "@/server/actions/clients";
import type { ClientStatus } from "@prisma/client";

export type ClientFormValues = {
  id?: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  status: ClientStatus;
  source: string | null;
  birthday: string | null;
  address: string | null;
  tags: string[];
  marketingOptIn: boolean;
};

const SOURCES = ["Instagram", "Telegram", "Viber", "Рекомендація", "Google", "Онлайн-запис", "Інше"];

export function ClientModal({
  open,
  onClose,
  onSaved,
  client,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  client?: ClientFormValues | null;
}) {
  const toast = useToast();
  const isEdit = Boolean(client?.id);
  const action = isEdit ? updateClientAction.bind(null, client!.id!) : createClientAction;
  const [state, formAction] = useActionState(action, null);
  const [marketing, setMarketing] = React.useState(client?.marketingOptIn ?? false);

  React.useEffect(() => {
    if (open) setMarketing(client?.marketingOptIn ?? false);
  }, [open, client]);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(isEdit ? "Дані клієнта оновлено" : "Клієнта додано");
      onSaved(state.data.id);
      onClose();
    } else if (!state.fieldErrors) {
      toast.error("Не вдалося зберегти", state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Редагувати клієнта" : "Новий клієнт"}
      description={isEdit ? undefined : "Достатньо імені — решту можна додати пізніше"}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="marketingOptIn" value={marketing ? "on" : ""} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ім'я" error={errors?.firstName}>
            <Input
              name="firstName"
              defaultValue={client?.firstName ?? ""}
              required
              autoFocus
              placeholder="Анна"
              invalid={Boolean(errors?.firstName)}
            />
          </Field>
          <Field label="Прізвище" hint="необов'язково" error={errors?.lastName}>
            <Input name="lastName" defaultValue={client?.lastName ?? ""} placeholder="Ковальчук" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон" error={errors?.phone}>
            <Input
              name="phone"
              type="tel"
              defaultValue={client?.phone ?? ""}
              placeholder="+380 XX XXX XX XX"
              invalid={Boolean(errors?.phone)}
            />
          </Field>
          <Field label="Email" error={errors?.email}>
            <Input
              name="email"
              type="email"
              defaultValue={client?.email ?? ""}
              placeholder="anna@email.com"
              invalid={Boolean(errors?.email)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Статус">
            <Select name="status" defaultValue={client?.status ?? "NEW"}>
              {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Джерело">
            <Select name="source" defaultValue={client?.source ?? ""}>
              <option value="">Не вказано</option>
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="День народження">
            <Input name="birthday" type="date" defaultValue={client?.birthday ?? ""} />
          </Field>
        </div>

        <Field label="Теги" hint="через кому">
          <Input
            name="tags"
            defaultValue={client?.tags?.join(", ") ?? ""}
            placeholder="постійний, манікюр, ранкові слоти"
          />
        </Field>

        <Field label="Адреса" hint="необов'язково">
          <Textarea name="address" defaultValue={client?.address ?? ""} rows={2} />
        </Field>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <Switch
            checked={marketing}
            onCheckedChange={setMarketing}
            label="Згода на розсилки"
            description="Клієнт дозволив надсилати акції та нагадування"
          />
        </div>

        {state && !state.ok && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
            <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <SubmitButton>{isEdit ? "Зберегти зміни" : "Додати клієнта"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

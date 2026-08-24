"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createEmployeeAction, updateEmployeeAction } from "@/server/actions/employees";
import type { ActionResult } from "@/lib/errors";

const COLORS = [
  "#2563EB", "#0891B2", "#0D9488", "#059669", "#7C3AED",
  "#DB2777", "#D97706", "#DC2626", "#475569", "#4F46E5",
];

export type EmployeeFormValues = {
  id?: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  color: string;
  bio: string | null;
  isActive: boolean;
  acceptsOnlineBooking: boolean;
  serviceIds: string[];
};

export function EmployeeModal({
  open,
  onClose,
  onSaved,
  employee,
  services,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee?: EmployeeFormValues | null;
  services: { id: string; name: string; color: string }[];
}) {
  const toast = useToast();
  const isEdit = Boolean(employee?.id);

  const [color, setColor] = React.useState(employee?.color ?? COLORS[0]);
  const [isActive, setIsActive] = React.useState(employee?.isActive ?? true);
  const [online, setOnline] = React.useState(employee?.acceptsOnlineBooking ?? true);
  const [selected, setSelected] = React.useState<string[]>(employee?.serviceIds ?? []);

  const [state, formAction] = useActionState(
    async (prev: ActionResult<{ id: string }> | null, formData: FormData) => {
      const result = isEdit
        ? await updateEmployeeAction(employee!.id!, prev, formData)
        : await createEmployeeAction(prev, formData);

      if (result.ok) {
        toast.success(
          isEdit ? "Дані оновлено" : "Співробітника додано",
          isEdit ? undefined : "Графік 09:00–18:00 створено автоматично",
        );
        onSaved();
        onClose();
      } else if (!result.fieldErrors) {
        toast.error("Не вдалося зберегти", result.error);
      }
      return result;
    },
    null,
  );

  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setColor(employee?.color ?? COLORS[0]);
      setIsActive(employee?.isActive ?? true);
      setOnline(employee?.acceptsOnlineBooking ?? true);
      setSelected(employee?.serviceIds ?? services.map((s) => s.id));
    }
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Редагувати співробітника" : "Новий співробітник"}
      description={isEdit ? undefined : "Графік і послуги можна змінити в будь-який момент"}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
        <input type="hidden" name="acceptsOnlineBooking" value={online ? "on" : "off"} />
        {selected.map((id) => (
          <input key={id} type="hidden" name="serviceIds" value={id} />
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ім'я" error={errors?.name}>
            <Input
              name="name"
              defaultValue={employee?.name ?? ""}
              required
              autoFocus
              placeholder="Марія"
              invalid={Boolean(errors?.name)}
            />
          </Field>
          <Field label="Посада">
            <Input name="position" defaultValue={employee?.position ?? ""} placeholder="Майстер манікюру" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон" error={errors?.phone}>
            <Input name="phone" type="tel" defaultValue={employee?.phone ?? ""} placeholder="+380 XX XXX XX XX" />
          </Field>
          <Field label="Email" error={errors?.email}>
            <Input name="email" type="email" defaultValue={employee?.email ?? ""} />
          </Field>
        </div>

        <Field label="Колір у календарі">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {COLORS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={`Колір ${value}`}
                className={cn(
                  "h-7 w-7 rounded-lg transition-transform",
                  color === value
                    ? "scale-110 ring-2 ring-[var(--fg)] ring-offset-2 ring-offset-[var(--surface)]"
                    : "hover:scale-105",
                )}
                style={{ background: value }}
              />
            ))}
          </div>
        </Field>

        <Field label="Про співробітника" hint="показується на сторінці онлайн-запису">
          <Textarea name="bio" defaultValue={employee?.bio ?? ""} rows={2} />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--fg)]">
            Які послуги виконує{" "}
            <span className="font-normal text-[var(--fg-subtle)]">
              ({selected.length} із {services.length})
            </span>
          </p>
          {services.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-subtle)]">
              Спершу створіть послуги — тоді їх можна буде призначити.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {services.map((service) => {
                const active = selected.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(service.id)
                          ? prev.filter((x) => x !== service.id)
                          : [...prev, service.id],
                      )
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-transparent bg-[var(--primary)] text-white"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: active ? "white" : service.color }}
                      aria-hidden
                    />
                    {service.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            label="Працює зараз"
            description="Неактивні співробітники не показуються в календарі"
          />
          <div className="h-px bg-[var(--border)]" />
          <Switch
            checked={online}
            onCheckedChange={setOnline}
            label="Приймає онлайн-записи"
            description="Клієнти зможуть обрати цього майстра на публічній сторінці"
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
          <SubmitButton>{isEdit ? "Зберегти зміни" : "Додати співробітника"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

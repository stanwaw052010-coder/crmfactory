"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { centsToInput, currencySymbol } from "@/lib/money";
import { createServiceAction, updateServiceAction } from "@/server/actions/services";
import type { ActionResult } from "@/lib/errors";

const COLORS = [
  "#2563EB", "#0891B2", "#0D9488", "#059669", "#7C3AED",
  "#DB2777", "#D97706", "#DC2626", "#475569", "#4F46E5",
];

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

export type ServiceFormValues = {
  id?: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  color: string;
  isActive: boolean;
  onlineBooking: boolean;
  employeeIds: string[];
};

export function ServiceModal({
  open,
  onClose,
  onSaved,
  service,
  categories,
  employees,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  service?: ServiceFormValues | null;
  categories: { id: string; name: string }[];
  employees: { id: string; name: string; position: string | null; color: string }[];
  currency: string;
}) {
  const toast = useToast();
  const isEdit = Boolean(service?.id);

  const [color, setColor] = React.useState(service?.color ?? COLORS[0]);
  const [isActive, setIsActive] = React.useState(service?.isActive ?? true);
  const [onlineBooking, setOnlineBooking] = React.useState(service?.onlineBooking ?? true);
  const [selected, setSelected] = React.useState<string[]>(service?.employeeIds ?? []);

  const [state, formAction] = useActionState(
    async (prev: ActionResult<{ id: string }> | null, formData: FormData) => {
      const result = isEdit
        ? await updateServiceAction(service!.id!, prev, formData)
        : await createServiceAction(prev, formData);

      if (result.ok) {
        toast.success(isEdit ? "Послугу оновлено" : "Послугу створено");
        onSaved();
        onClose();
      } else if (!result.fieldErrors) {
        toast.error("Не вдалося зберегти", result.error);
      }
      return result;
    },
    null,
  );

  // Наповнення форми при відкритті — під час рендеру, без ефекту.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setColor(service?.color ?? COLORS[0]);
      setIsActive(service?.isActive ?? true);
      setOnlineBooking(service?.onlineBooking ?? true);
      setSelected(service?.employeeIds ?? employees.map((e) => e.id));
    }
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const toggleEmployee = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Редагувати послугу" : "Нова послуга"}
      description="Тривалість і ціна автоматично підставляться під час створення запису"
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
        <input type="hidden" name="onlineBooking" value={onlineBooking ? "on" : "off"} />
        {selected.map((id) => (
          <input key={id} type="hidden" name="employeeIds" value={id} />
        ))}

        <Field label="Назва послуги" error={errors?.name}>
          <Input
            name="name"
            defaultValue={service?.name ?? ""}
            required
            autoFocus
            placeholder="Манікюр з покриттям"
            invalid={Boolean(errors?.name)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Категорія">
            <Select name="categoryId" defaultValue={service?.categoryId ?? ""}>
              <option value="">Без категорії</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
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
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Тривалість" error={errors?.durationMin}>
            <Select name="durationMin" defaultValue={String(service?.durationMin ?? 60)}>
              {DURATIONS.map((value) => (
                <option key={value} value={value}>
                  {value} хв
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ціна" hint={currencySymbol(currency)} error={errors?.priceCents}>
            <Input
              name="price"
              inputMode="decimal"
              defaultValue={service ? centsToInput(service.priceCents) : "0"}
              placeholder="35"
            />
          </Field>
          <Field label="Пауза після" hint="хв">
            <Select name="bufferMin" defaultValue={String(service?.bufferMin ?? 0)}>
              {[0, 5, 10, 15, 20, 30].map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Без паузи" : `${value} хв`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Опис" hint="показується на сторінці онлайн-запису">
          <Textarea
            name="description"
            defaultValue={service?.description ?? ""}
            rows={2}
            placeholder="Що входить у послугу"
          />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--fg)]">
            Хто виконує{" "}
            <span className="font-normal text-[var(--fg-subtle)]">
              ({selected.length} із {employees.length})
            </span>
          </p>
          {employees.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-subtle)]">
              Спочатку додайте співробітників — тоді послугу можна буде призначити.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {employees.map((employee) => {
                const active = selected.includes(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => toggleEmployee(employee.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-transparent bg-[var(--primary)] text-white"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: active ? "white" : employee.color }}
                      aria-hidden
                    />
                    {employee.name}
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
            label="Активна послуга"
            description="Неактивні послуги не пропонуються при створенні запису"
          />
          <div className="h-px bg-[var(--border)]" />
          <Switch
            checked={onlineBooking}
            onCheckedChange={setOnlineBooking}
            label="Доступна для онлайн-запису"
            description="Клієнти зможуть обрати її на публічній сторінці"
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
          <SubmitButton>{isEdit ? "Зберегти зміни" : "Створити послугу"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

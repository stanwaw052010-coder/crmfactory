"use client";

import * as React from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  ACTION_HINTS,
  ACTION_LABELS,
  APPOINTMENT_TRIGGERS,
  COMPARISON_LABELS,
  CONDITION_LABELS,
  TEMPLATE_KEYS,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  type AutomationAction,
  type AutomationCondition,
  type AutomationInput,
} from "@/lib/automation";
import { saveAutomationAction } from "@/server/actions/automations";
import type { AutomationTrigger } from "@prisma/client";

const CLIENT_STATUSES = ["NEW", "ACTIVE", "VIP", "INACTIVE", "BLOCKED"] as const;

/** Порожні заготовки — щоб «Додати умову» одразу давала робочий рядок. */
function blankCondition(type: AutomationCondition["type"]): AutomationCondition {
  switch (type) {
    case "visitCount":
      return { type: "visitCount", op: "gte", value: 5 };
    case "serviceId":
      return { type: "serviceId", value: "" };
    case "priceCents":
      return { type: "priceCents", op: "gte", value: 5000 };
    case "clientStatus":
      return { type: "clientStatus", value: "NEW" };
    case "source":
      return { type: "source", value: "ONLINE" };
  }
}

function blankAction(type: AutomationAction["type"]): AutomationAction {
  switch (type) {
    case "notify":
      return { type: "notify", title: "{{клієнт}} — потрібна увага", body: "" };
    case "tagClient":
      return { type: "tagClient", tag: "" };
    case "setClientStatus":
      return { type: "setClientStatus", status: "VIP" };
    case "createLead":
      return { type: "createLead", title: "Передзвонити {{клієнт}}", note: "" };
  }
}

export type AutomationDraft = AutomationInput & { id?: string };

export function AutomationEditor({
  open,
  onClose,
  onSaved,
  automation,
  services,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  automation?: AutomationDraft | null;
  services: { id: string; name: string }[];
}) {
  const isEdit = Boolean(automation?.id);

  const [name, setName] = React.useState("");
  const [trigger, setTrigger] = React.useState<AutomationTrigger>("APPOINTMENT_COMPLETED");
  const [conditions, setConditions] = React.useState<AutomationCondition[]>([]);
  const [actions, setActions] = React.useState<AutomationAction[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Заповнення під час рендеру, а не в ефекті — інакше на мить видно
  // значення попереднього правила.
  const [formKey, setFormKey] = React.useState(() => `${open}:${automation?.id ?? "new"}`);
  const nextKey = `${open}:${automation?.id ?? "new"}`;
  if (formKey !== nextKey) {
    setFormKey(nextKey);
    setError(null);
    if (automation) {
      setName(automation.name);
      setTrigger(automation.trigger as AutomationTrigger);
      setConditions(automation.conditions);
      setActions(automation.actions);
    } else {
      setName("");
      setTrigger("APPOINTMENT_COMPLETED");
      setConditions([]);
      setActions([blankAction("notify")]);
    }
  }

  const hasAppointment = APPOINTMENT_TRIGGERS.includes(trigger);

  // Умови, що спираються на запис, для тригера «новий клієнт» безглузді:
  // запису в цей момент ще немає.
  const availableConditions = (
    Object.keys(CONDITION_LABELS) as AutomationCondition["type"][]
  ).filter((type) =>
    hasAppointment ? true : type === "clientStatus" || type === "visitCount",
  );

  const save = async () => {
    setError(null);
    setSaving(true);
    const result = await saveAutomationAction(automation?.id ?? null, {
      name,
      trigger,
      conditions,
      actions,
      isActive: true,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Змінити правило" : "Нове правило"}
      description="Коли станеться подія → якщо умови збігаються → виконати дії"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button onClick={save} loading={saving} disabled={actions.length === 0}>
            {isEdit ? "Зберегти" : "Створити правило"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="animate-fade-up flex items-start gap-2 rounded-xl bg-[var(--danger-soft)] px-3.5 py-3 text-[13px] text-[var(--danger)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Field label="Назва правила">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Позначати VIP після 15 візитів"
          />
        </Field>

        <Step index={1} title="Коли">
          <Select
            value={trigger}
            onChange={(event) => {
              const next = event.target.value as AutomationTrigger;
              setTrigger(next);
              // Умови по запису для «нового клієнта» не мають сенсу —
              // прибираємо їх одразу, а не показуємо помилку при збереженні.
              if (!APPOINTMENT_TRIGGERS.includes(next)) {
                setConditions((current) =>
                  current.filter(
                    (condition) =>
                      condition.type === "clientStatus" || condition.type === "visitCount",
                  ),
                );
              }
            }}
          >
            {(Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map((key) => (
              <option key={key} value={key}>
                {TRIGGER_LABELS[key]}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[12px] text-[var(--fg-subtle)]">{TRIGGER_HINTS[trigger]}</p>
        </Step>

        <Step index={2} title="Якщо" hint="усі умови мають виконатись; без умов правило спрацьовує завжди">
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <ConditionRow
                key={index}
                condition={condition}
                services={services}
                onChange={(next) =>
                  setConditions((current) =>
                    current.map((item, i) => (i === index ? next : item)),
                  )
                }
                onRemove={() =>
                  setConditions((current) => current.filter((_, i) => i !== index))
                }
              />
            ))}

            {conditions.length < 5 && (
              <AddRow
                label="Додати умову"
                options={availableConditions.map((type) => ({
                  value: type,
                  label: CONDITION_LABELS[type],
                }))}
                onPick={(type) =>
                  setConditions((current) => [
                    ...current,
                    blankCondition(type as AutomationCondition["type"]),
                  ])
                }
              />
            )}
          </div>
        </Step>

        <Step index={3} title="Тоді">
          <div className="space-y-2">
            {actions.map((action, index) => (
              <ActionRow
                key={index}
                action={action}
                onChange={(next) =>
                  setActions((current) => current.map((item, i) => (i === index ? next : item)))
                }
                onRemove={() => setActions((current) => current.filter((_, i) => i !== index))}
              />
            ))}

            {actions.length < 5 && (
              <AddRow
                label="Додати дію"
                options={(Object.keys(ACTION_LABELS) as AutomationAction["type"][]).map(
                  (type) => ({ value: type, label: ACTION_LABELS[type] }),
                )}
                onPick={(type) =>
                  setActions((current) => [...current, blankAction(type as AutomationAction["type"])])
                }
              />
            )}
          </div>

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--fg-subtle)]">
            У текстах працюють підстановки:{" "}
            {TEMPLATE_KEYS.map((key) => (
              <code key={key} className="mr-1 font-mono">{`{{${key}}}`}</code>
            ))}
          </p>
        </Step>
      </div>
    </Modal>
  );
}

function Step({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-semibold text-white">
          {index}
        </span>
        <span className="text-[13px] font-semibold text-[var(--fg)]">{title}</span>
        {hint && <span className="text-[11.5px] text-[var(--fg-subtle)]">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="animate-fade-up flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Прибрати"
        className="mt-1 shrink-0 rounded-lg p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ConditionRow({
  condition,
  services,
  onChange,
  onRemove,
}: {
  condition: AutomationCondition;
  services: { id: string; name: string }[];
  onChange: (next: AutomationCondition) => void;
  onRemove: () => void;
}) {
  return (
    <Row onRemove={onRemove}>
      <div className="flex items-center text-[13px] font-medium text-[var(--fg)] sm:col-span-2">
        {CONDITION_LABELS[condition.type]}
      </div>

      {(condition.type === "visitCount" || condition.type === "priceCents") && (
        <>
          <Select
            value={condition.op}
            onChange={(event) =>
              onChange({ ...condition, op: event.target.value as "eq" | "gte" | "lte" })
            }
          >
            {(Object.keys(COMPARISON_LABELS) as ("eq" | "gte" | "lte")[]).map((op) => (
              <option key={op} value={op}>
                {COMPARISON_LABELS[op]}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={0}
            value={condition.type === "priceCents" ? condition.value / 100 : condition.value}
            onChange={(event) => {
              const raw = Number(event.target.value) || 0;
              onChange({
                ...condition,
                value: condition.type === "priceCents" ? Math.round(raw * 100) : raw,
              });
            }}
          />
        </>
      )}

      {condition.type === "serviceId" && (
        <Select
          className="sm:col-span-2"
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        >
          <option value="">Оберіть послугу</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>
      )}

      {condition.type === "clientStatus" && (
        <Select
          className="sm:col-span-2"
          value={condition.value}
          onChange={(event) =>
            onChange({ ...condition, value: event.target.value as (typeof CLIENT_STATUSES)[number] })
          }
        >
          {CLIENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      )}

      {condition.type === "source" && (
        <Select
          className="sm:col-span-2"
          value={condition.value}
          onChange={(event) =>
            onChange({ ...condition, value: event.target.value as "CRM" | "ONLINE" | "IMPORT" })
          }
        >
          <option value="ONLINE">Онлайн-запис</option>
          <option value="CRM">Створено в CRM</option>
          <option value="IMPORT">Імпорт</option>
        </Select>
      )}
    </Row>
  );
}

function ActionRow({
  action,
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  onChange: (next: AutomationAction) => void;
  onRemove: () => void;
}) {
  return (
    <Row onRemove={onRemove}>
      <div className="sm:col-span-2">
        <p className="text-[13px] font-medium text-[var(--fg)]">{ACTION_LABELS[action.type]}</p>
        <p className="text-[11.5px] text-[var(--fg-subtle)]">{ACTION_HINTS[action.type]}</p>
      </div>

      {action.type === "notify" && (
        <>
          <Input
            className="sm:col-span-2"
            value={action.title}
            onChange={(event) => onChange({ ...action, title: event.target.value })}
            placeholder="Заголовок сповіщення"
          />
          <Textarea
            className="sm:col-span-2"
            rows={2}
            value={action.body ?? ""}
            onChange={(event) => onChange({ ...action, body: event.target.value })}
            placeholder="Текст (необов'язково)"
          />
        </>
      )}

      {action.type === "tagClient" && (
        <Input
          className="sm:col-span-2"
          value={action.tag}
          onChange={(event) => onChange({ ...action, tag: event.target.value })}
          placeholder="Наприклад: постійна"
        />
      )}

      {action.type === "setClientStatus" && (
        <Select
          className="sm:col-span-2"
          value={action.status}
          onChange={(event) =>
            onChange({ ...action, status: event.target.value as (typeof CLIENT_STATUSES)[number] })
          }
        >
          {CLIENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      )}

      {action.type === "createLead" && (
        <>
          <Input
            className="sm:col-span-2"
            value={action.title}
            onChange={(event) => onChange({ ...action, title: event.target.value })}
            placeholder="Назва заявки"
          />
          <Textarea
            className="sm:col-span-2"
            rows={2}
            value={action.note ?? ""}
            onChange={(event) => onChange({ ...action, note: event.target.value })}
            placeholder="Нотатка (необов'язково)"
          />
        </>
      )}
    </Row>
  );
}

function AddRow({
  label,
  options,
  onPick,
}: {
  label: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-strong)] py-2.5 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="animate-fade-up flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onPick(option.value);
            setOpen(false);
          }}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] text-[var(--fg)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
        >
          {option.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-[var(--fg-subtle)] hover:text-[var(--fg)]"
      >
        Скасувати
      </button>
    </div>
  );
}

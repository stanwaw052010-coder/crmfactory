"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { centsToInput, currencySymbol, formatMoney } from "@/lib/money";
import { durationLabel, formatTime, toDateKey } from "@/lib/time";
import { APPOINTMENT_STATUS_LABELS } from "@/components/shared/status";
import {
  createAppointmentAction,
  getFreeSlotsAction,
  updateAppointmentAction,
} from "@/server/actions/appointments";
import { quickCreateClientAction } from "@/server/actions/clients";
import type {
  CalendarAppointment,
  CalendarClient,
  CalendarEmployee,
  CalendarService,
} from "@/features/calendar/types";

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

export function AppointmentModal({
  open,
  onClose,
  onSaved,
  appointment,
  defaults,
  clients,
  services,
  employees,
  currency,
  lockedEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: CalendarAppointment | null;
  defaults: { date: string; time: string; employeeId?: string };
  clients: CalendarClient[];
  services: CalendarService[];
  employees: CalendarEmployee[];
  currency: string;
  lockedEmployeeId: string | null;
}) {
  const toast = useToast();
  const isEdit = Boolean(appointment);

  const action = isEdit
    ? updateAppointmentAction.bind(null, appointment!.id)
    : createAppointmentAction;
  const [state, formAction] = useActionState(action, null);

  const [clientId, setClientId] = React.useState("");
  const [clientQuery, setClientQuery] = React.useState("");
  const [showClientList, setShowClientList] = React.useState(false);
  const [creatingClient, setCreatingClient] = React.useState(false);
  const [serviceId, setServiceId] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [date, setDate] = React.useState(defaults.date);
  const [time, setTime] = React.useState(defaults.time);
  const [duration, setDuration] = React.useState(60);
  const [price, setPrice] = React.useState("0");
  const [status, setStatus] = React.useState("CONFIRMED");
  const [slots, setSlots] = React.useState<string[] | null>(null);
  const [slotsLoading, startSlots] = React.useTransition();

  // Наповнення форми при відкритті: редагування — з запису, створення — з дефолтів.
  // Робимо під час рендеру (документований React-патерн), а не в ефекті —
  // інакше користувач на мить побачив би попередні значення.
  const [formKey, setFormKey] = React.useState(() => `${open}:${appointment?.id ?? "new"}`);
  const nextFormKey = `${open}:${appointment?.id ?? "new"}`;
  if (formKey !== nextFormKey) {
    setFormKey(nextFormKey);
    if (open) {
    if (appointment) {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);
      setClientId(appointment.client.id);
      setClientQuery(
        `${appointment.client.firstName} ${appointment.client.lastName ?? ""}`.trim(),
      );
      setServiceId(appointment.service.id);
      setEmployeeId(appointment.employee.id);
      setDate(toDateKey(start));
      setTime(formatTime(start));
      setDuration(Math.round((end.getTime() - start.getTime()) / 60_000));
      setPrice(centsToInput(appointment.priceCents));
      setStatus(appointment.status);
    } else {
      setClientId("");
      setClientQuery("");
      setServiceId("");
      setEmployeeId(lockedEmployeeId ?? defaults.employeeId ?? employees[0]?.id ?? "");
      setDate(defaults.date);
      setTime(defaults.time);
      setDuration(60);
      setPrice("0");
      setStatus("CONFIRMED");
    }
    setShowClientList(false);
    }
  }

  // Вибір послуги підставляє її тривалість і ціну — але не перетирає
  // те, що менеджер уже змінив вручну під час редагування.
  const applyService = (id: string) => {
    setServiceId(id);
    const service = services.find((s) => s.id === id);
    if (!service) return;
    setDuration(service.durationMin);
    setPrice(centsToInput(service.priceCents));
    if (service.employeeIds.length > 0 && !service.employeeIds.includes(employeeId)) {
      setEmployeeId(lockedEmployeeId ?? service.employeeIds[0]);
    }
  };

  // Вільні слоти для обраного співробітника й дати.
  React.useEffect(() => {
    if (!open || !employeeId || !date) {
      startSlots(() => setSlots(null));
      return;
    }
    let cancelled = false;
    startSlots(async () => {
      const res = await getFreeSlotsAction({
        employeeId,
        date,
        durationMin: duration,
        ignoreAppointmentId: appointment?.id,
      });
      if (cancelled) return;
      setSlots(res.ok ? res.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, date, duration, appointment?.id]);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(
        isEdit ? "Запис оновлено" : "Запис створено",
        state.data && "warning" in state.data && state.data.warning
          ? state.data.warning
          : undefined,
      );
      onSaved();
      onClose();
    } else {
      toast.error("Не вдалося зберегти запис", state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const filteredClients = React.useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter((client) =>
        `${client.firstName} ${client.lastName ?? ""} ${client.phone ?? ""}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 8);
  }, [clients, clientQuery]);

  const availableEmployees = React.useMemo(() => {
    const service = services.find((s) => s.id === serviceId);
    if (!service || service.employeeIds.length === 0) return employees;
    return employees.filter((employee) => service.employeeIds.includes(employee.id));
  }, [services, serviceId, employees]);

  const createClient = async () => {
    const name = clientQuery.trim();
    if (name.length < 2) return;
    setCreatingClient(true);
    const result = await quickCreateClientAction({ firstName: name });
    setCreatingClient(false);
    if (result.ok) {
      setClientId(result.data.id);
      setClientQuery(result.data.label);
      setShowClientList(false);
      toast.success("Клієнта створено", "Деталі можна доповнити пізніше");
    } else {
      toast.error("Не вдалося створити клієнта", result.error);
    }
  };

  const slotTaken = slots !== null && !slots.includes(time);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Редагувати запис" : "Новий запис"}
      description={
        isEdit ? "Зміни одразу відображаються в календарі" : "Клієнт → послуга → час → готово"
      }
    >
      <form action={formAction} className="space-y-4" id="appointment-form">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="durationMin" value={duration} />

        {/* Клієнт */}
        <Field label="Клієнт" error={state && !state.ok ? state.fieldErrors?.clientId : undefined}>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
            <Input
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setClientId("");
                setShowClientList(true);
              }}
              onFocus={() => setShowClientList(true)}
              placeholder="Почніть вводити ім'я або телефон"
              className="pl-9"
              autoComplete="off"
            />
            {clientId && (
              <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[var(--success)]" />
            )}

            {showClientList && !clientId && (
              <div className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)]">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setClientId(client.id);
                      setClientQuery(
                        `${client.firstName} ${client.lastName ?? ""}`.trim(),
                      );
                      setShowClientList(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <span className="truncate text-[13px] font-medium text-[var(--fg)]">
                      {client.firstName} {client.lastName ?? ""}
                    </span>
                    {client.phone && (
                      <span className="shrink-0 text-[12px] text-[var(--fg-subtle)]">
                        {client.phone}
                      </span>
                    )}
                  </button>
                ))}
                {clientQuery.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={createClient}
                    disabled={creatingClient}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
                  >
                    {creatingClient ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Створити «{clientQuery.trim()}»
                  </button>
                )}
                {filteredClients.length === 0 && clientQuery.trim().length < 2 && (
                  <p className="px-2.5 py-3 text-[12.5px] text-[var(--fg-subtle)]">
                    Введіть ім&apos;я, щоб знайти або створити клієнта
                  </p>
                )}
              </div>
            )}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Послуга" error={state && !state.ok ? state.fieldErrors?.serviceId : undefined}>
            <Select
              name="serviceId"
              value={serviceId}
              onChange={(e) => applyService(e.target.value)}
              required
            >
              <option value="">Оберіть послугу</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {durationLabel(service.durationMin)} ·{" "}
                  {formatMoney(service.priceCents, currency)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Співробітник">
            <Select
              name="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={Boolean(lockedEmployeeId)}
              required
            >
              {availableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.position ? ` · ${employee.position}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Дата">
            <Input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Час">
            <Input name="time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
          <Field label="Тривалість">
            <Select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((value) => (
                <option key={value} value={value}>
                  {durationLabel(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Вільні слоти */}
        {employeeId && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-[var(--fg-muted)]">
              Вільний час
              {slotsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>
            {slots && slots.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                      time === slot
                        ? "border-transparent bg-[var(--primary)] text-white"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : slots && slots.length === 0 ? (
              <p className="text-[12.5px] text-[var(--fg-subtle)]">
                Цього дня вільних слотів немає — перевірте графік співробітника.
              </p>
            ) : null}

            {slotTaken && (
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-[var(--warning)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Обраний час поза вільними слотами. Зберегти можна, але перевірте графік.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ціна" hint={currencySymbol(currency)}>
            <Input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Статус">
            <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Коментар" hint="необов'язково">
          <Textarea
            name="note"
            defaultValue={appointment?.note ?? ""}
            placeholder="Побажання клієнта, деталі візиту…"
            rows={2}
          />
        </Field>

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
          <SubmitButton disabled={!clientId || !serviceId}>
            {isEdit ? "Зберегти зміни" : "Створити запис"}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

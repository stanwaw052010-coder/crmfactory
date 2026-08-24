"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  Cake,
  Mail,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Phone,
  Pin,
  Repeat,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import {
  AppointmentStatusBadge,
  ClientStatusBadge,
  PaymentStatusBadge,
  PAYMENT_METHOD_LABELS,
} from "@/components/shared/status";
import { ClientModal, type ClientFormValues } from "@/features/clients/client-modal";
import { addClientNoteAction, deleteClientNoteAction } from "@/server/actions/clients";
import { formatMoney } from "@/lib/money";
import { formatDateUk, formatTime, relativeUk, toDateKey } from "@/lib/time";
import type { AppointmentStatus, ClientStatus, PaymentStatus } from "@prisma/client";

type Appointment = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priceCents: number;
  note: string | null;
  service: { name: string; color: string };
  employee: { name: string; color: string };
};

type Payment = {
  id: string;
  amountCents: number;
  method: string;
  status: PaymentStatus;
  paidAt: Date;
  note: string | null;
  employee: { name: string } | null;
};

type Note = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: { name: string } | null;
};

export function ClientProfile({
  client,
  appointments,
  payments,
  notes,
  stats,
  nextVisit,
  currency,
  canUpdate,
  canCreateAppointment,
}: {
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    status: ClientStatus;
    source: string | null;
    address: string | null;
    birthday: Date | null;
    tags: string[];
    marketingOptIn: boolean;
    createdAt: Date;
  };
  appointments: Appointment[];
  payments: Payment[];
  notes: Note[];
  stats: {
    visits: number;
    totalCents: number;
    averageCents: number;
    cancelled: number;
    noShow: number;
  };
  nextVisit: { startAt: Date; service: { name: string }; employee: { name: string } } | null;
  currency: string;
  canUpdate: boolean;
  canCreateAppointment: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = React.useState("overview");
  const [editOpen, setEditOpen] = React.useState(false);
  const [noteState, noteAction] = useActionState(addClientNoteAction, null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (noteState?.ok) {
      toast.success("Нотатку додано");
      formRef.current?.reset();
      router.refresh();
    } else if (noteState && !noteState.ok) {
      toast.error("Не вдалося зберегти нотатку", noteState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteState]);

  const fullName = `${client.firstName} ${client.lastName ?? ""}`.trim();

  const formValues: ClientFormValues = {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    status: client.status,
    source: client.source,
    birthday: client.birthday ? toDateKey(client.birthday) : null,
    address: client.address,
    tags: client.tags,
    marketingOptIn: client.marketingOptIn,
  };

  const removeNote = async (id: string) => {
    const result = await deleteClientNoteAction(id);
    if (result.ok) {
      toast.success("Нотатку видалено");
      router.refresh();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Усі клієнти
      </Link>

      {/* Шапка профілю */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[var(--color-brand-600)] to-[var(--color-cyan)] opacity-90" />
        <CardBody className="pt-0">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar name={fullName} size="xl" ring className="ring-4" />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
                    {fullName}
                  </h1>
                  <ClientStatusBadge status={client.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--fg-muted)]">
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-[var(--primary)]">
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-[var(--primary)]">
                      <Mail className="h-3.5 w-3.5" />
                      {client.email}
                    </a>
                  )}
                  {client.birthday && (
                    <span className="flex items-center gap-1.5">
                      <Cake className="h-3.5 w-3.5" />
                      {formatDateUk(client.birthday)}
                    </span>
                  )}
                  {client.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {client.address}
                    </span>
                  )}
                </div>
                {client.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {client.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pb-1">
              {canUpdate && (
                <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Редагувати
                </Button>
              )}
              {canCreateAppointment && (
                <Link href="/calendar?new=1">
                  <Button size="sm">
                    <CalendarPlus className="h-4 w-4" />
                    Створити запис
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {nextVisit && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-soft)] px-4 py-3">
              <CalendarPlus className="h-4 w-4 shrink-0 text-[var(--primary)]" />
              <p className="text-[13px] text-[var(--fg)]">
                <span className="font-semibold">Наступний візит:</span>{" "}
                {formatDateUk(nextVisit.startAt)} о {formatTime(nextVisit.startAt)} —{" "}
                {nextVisit.service.name} · {nextVisit.employee.name}
              </p>
              <span className="ml-auto text-[12.5px] font-medium text-[var(--primary)]">
                {relativeUk(nextVisit.startAt)}
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Метрики */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Repeat} label="Всього візитів" value={String(stats.visits)} tone="brand" />
        <MetricCard
          icon={Wallet}
          label="Потрачено"
          value={formatMoney(stats.totalCents, currency)}
          tone="success"
        />
        <MetricCard
          icon={TrendingUp}
          label="Середній чек"
          value={formatMoney(stats.averageCents, currency)}
          tone="info"
        />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Огляд" },
          { value: "appointments", label: "Записи", count: appointments.length },
          { value: "payments", label: "Платежі", count: payments.length },
          { value: "notes", label: "Нотатки", count: notes.length },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Останні візити" />
            {appointments.length === 0 ? (
              <EmptyState compact icon={CalendarPlus} title="Візитів ще не було" />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {appointments.slice(0, 5).map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} currency={currency} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Профіль клієнта" />
            <CardBody className="space-y-3">
              <InfoLine label="Клієнт із" value={formatDateUk(client.createdAt, { year: true })} />
              <InfoLine label="Джерело" value={client.source ?? "Не вказано"} />
              <InfoLine label="Скасувань" value={String(stats.cancelled)} />
              <InfoLine label="Не прийшов" value={String(stats.noShow)} />
              <InfoLine
                label="Розсилки"
                value={client.marketingOptIn ? "Дозволено" : "Не дозволено"}
              />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "appointments" && (
        <Card>
          {appointments.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Записів ще немає"
              description="Створіть перший запис — він одразу з'явиться тут та в календарі."
              action={
                canCreateAppointment ? (
                  <Link href="/calendar?new=1">
                    <Button size="sm">Створити запис</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {appointments.map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} currency={currency} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <Card className="overflow-hidden">
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="Платежів ще немає" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-5 py-3 text-[11.5px] font-semibold text-[var(--fg-subtle)] uppercase">Дата</th>
                    <th className="px-5 py-3 text-[11.5px] font-semibold text-[var(--fg-subtle)] uppercase">Спосіб</th>
                    <th className="px-5 py-3 text-[11.5px] font-semibold text-[var(--fg-subtle)] uppercase">Співробітник</th>
                    <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--fg-subtle)] uppercase">Сума</th>
                    <th className="px-5 py-3 text-[11.5px] font-semibold text-[var(--fg-subtle)] uppercase">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3 text-[13px] text-[var(--fg-muted)]">
                        {formatDateUk(payment.paidAt)}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[var(--fg-muted)]">
                        {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[var(--fg-muted)]">
                        {payment.employee?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] font-semibold text-[var(--fg)] tabular-nums">
                        {formatMoney(payment.amountCents, currency)}
                      </td>
                      <td className="px-5 py-3">
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          {canUpdate && (
            <Card>
              <CardBody>
                <form ref={formRef} action={noteAction} className="space-y-3">
                  <input type="hidden" name="clientId" value={client.id} />
                  <Textarea
                    name="body"
                    required
                    rows={3}
                    placeholder="Внутрішня нотатка: вподобання, алергії, домовленості… Клієнт цього не бачить."
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
                      <input type="checkbox" name="pinned" className="accent-[var(--primary)]" />
                      Закріпити зверху
                    </label>
                    <SubmitButton size="sm">
                      <MessageSquarePlus className="h-4 w-4" />
                      Додати нотатку
                    </SubmitButton>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {notes.length === 0 ? (
            <Card>
              <EmptyState
                icon={MessageSquarePlus}
                title="Нотаток ще немає"
                description="Фіксуйте деталі, які допоможуть команді обслуговувати клієнта краще."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardBody className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[var(--fg)]">
                        {note.body}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {note.pinned && <Pin className="h-3.5 w-3.5 text-[var(--primary)]" />}
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => removeNote(note.id)}
                            aria-label="Видалити нотатку"
                            className="rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--fg-subtle)]">
                      {note.author?.name ?? "Система"} · {relativeUk(note.createdAt)}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <ClientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
        client={formValues}
      />
    </div>
  );
}

function AppointmentRow({
  appointment,
  currency,
}: {
  appointment: Appointment;
  currency: string;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span
        className="h-9 w-1 shrink-0 rounded-full"
        style={{ background: appointment.service.color }}
        aria-hidden
      />
      <div className="w-20 shrink-0">
        <p className="text-[13px] font-medium text-[var(--fg)]">
          {formatDateUk(appointment.startAt)}
        </p>
        <p className="text-[11.5px] text-[var(--fg-subtle)] tabular-nums">
          {formatTime(appointment.startAt)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-[var(--fg)]">
          {appointment.service.name}
        </p>
        <p className="truncate text-[12px] text-[var(--fg-muted)]">{appointment.employee.name}</p>
      </div>
      <span className="shrink-0 text-[13px] font-semibold text-[var(--fg)] tabular-nums">
        {formatMoney(appointment.priceCents, currency)}
      </span>
      <div className="shrink-0">
        <AppointmentStatusBadge status={appointment.status} />
      </div>
    </li>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "brand" | "success" | "info";
}) {
  const toneClass = {
    brand: "bg-[var(--primary-soft)] text-[var(--primary)]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  }[tone];

  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] text-[var(--fg-muted)]">{label}</p>
        <p className="mt-0.5 text-[20px] leading-none font-semibold text-[var(--fg)] tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13.5px]">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="font-medium text-[var(--fg)]">{value}</span>
    </div>
  );
}

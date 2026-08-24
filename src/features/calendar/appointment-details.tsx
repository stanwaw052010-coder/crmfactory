"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { durationLabel, formatDateUk, formatTime } from "@/lib/time";
import { APPOINTMENT_STATUS_LABELS } from "@/components/shared/status";
import {
  deleteAppointmentAction,
  setAppointmentStatusAction,
} from "@/server/actions/appointments";
import type { CalendarAppointment } from "@/features/calendar/types";
import type { AppointmentStatus } from "@prisma/client";

const STATUS_ORDER: AppointmentStatus[] = [
  "WAITING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  WAITING: "data-[on=true]:bg-[var(--warning)] data-[on=true]:text-white",
  CONFIRMED: "data-[on=true]:bg-[var(--primary)] data-[on=true]:text-white",
  COMPLETED: "data-[on=true]:bg-[var(--success)] data-[on=true]:text-white",
  CANCELLED: "data-[on=true]:bg-[var(--danger)] data-[on=true]:text-white",
  NO_SHOW: "data-[on=true]:bg-[var(--fg-subtle)] data-[on=true]:text-white",
};

export function AppointmentDetails({
  appointment,
  open,
  onClose,
  onEdit,
  onChanged,
  currency,
  canEdit,
  canDelete,
}: {
  appointment: CalendarAppointment | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
  currency: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!appointment) return null;

  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const duration = Math.round((end.getTime() - start.getTime()) / 60_000);

  const changeStatus = async (status: AppointmentStatus) => {
    setPending(status);
    const result = await setAppointmentStatusAction({ id: appointment.id, status });
    setPending(null);
    if (result.ok) {
      toast.success(`Статус: ${APPOINTMENT_STATUS_LABELS[status]}`);
      onChanged();
      if (status === "COMPLETED") {
        toast.info("Продаж додано", "Завершений запис автоматично потрапив у розділ «Продажі»");
      }
    } else {
      toast.error("Не вдалося змінити статус", result.error);
    }
  };

  const remove = async () => {
    setPending("delete");
    const result = await deleteAppointmentAction(appointment.id);
    setPending(null);
    setConfirmDelete(false);
    if (result.ok) {
      toast.success("Запис видалено");
      onChanged();
      onClose();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="md"
        title="Деталі запису"
        footer={
          <>
            {canDelete && (
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="mr-auto text-[var(--danger)]"
              >
                <Trash2 className="h-4 w-4" />
                Видалити
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Закрити
            </Button>
            {canEdit && (
              <Button onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Редагувати
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 h-10 w-1 shrink-0 rounded-full"
              style={{ background: appointment.service.color }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] leading-tight font-semibold text-[var(--fg)]">
                {appointment.service.name}
              </h3>
              <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
                {formatDateUk(start, { year: true, weekday: true })}
              </p>
            </div>
            {appointment.source === "ONLINE" && <Badge tone="info">Онлайн-запис</Badge>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Clock} label="Час">
              {formatTime(start)} – {formatTime(end)}{" "}
              <span className="text-[var(--fg-subtle)]">({durationLabel(duration)})</span>
            </InfoRow>
            <InfoRow icon={Wallet} label="Вартість">
              <span className="font-semibold">{formatMoney(appointment.priceCents, currency)}</span>
            </InfoRow>
            <InfoRow icon={User} label="Клієнт">
              <Link
                href={`/clients/${appointment.client.id}`}
                className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
              >
                {appointment.client.firstName} {appointment.client.lastName ?? ""}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </InfoRow>
            <InfoRow icon={Calendar} label="Співробітник">
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={appointment.employee.name} color={appointment.employee.color} size="xs" />
                {appointment.employee.name}
              </span>
            </InfoRow>
            {appointment.client.phone && (
              <InfoRow icon={Phone} label="Телефон">
                <a href={`tel:${appointment.client.phone}`} className="hover:underline">
                  {appointment.client.phone}
                </a>
              </InfoRow>
            )}
          </div>

          {appointment.note && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
              <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[var(--fg-subtle)]">
                <MessageSquare className="h-3.5 w-3.5" />
                Коментар
              </p>
              <p className="text-[13px] leading-relaxed text-[var(--fg)]">{appointment.note}</p>
            </div>
          )}

          {canEdit && (
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-[var(--fg-muted)]">Статус запису</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_ORDER.map((status) => {
                  const active = appointment.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      data-on={active}
                      disabled={pending !== null}
                      onClick={() => !active && changeStatus(status)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-all disabled:opacity-60",
                        active
                          ? "border-transparent"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]",
                        STATUS_STYLES[status],
                      )}
                    >
                      {APPOINTMENT_STATUS_LABELS[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={pending === "delete"}
        title="Видалити запис?"
        description="Запис зникне з календаря та історії клієнта. Цю дію не можна скасувати. Якщо клієнт просто не прийшов — краще змінити статус."
        confirmLabel="Видалити"
      />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
      <div className="min-w-0">
        <p className="text-[11.5px] text-[var(--fg-subtle)]">{label}</p>
        <p className="mt-0.5 text-[13.5px] text-[var(--fg)]">{children}</p>
      </div>
    </div>
  );
}

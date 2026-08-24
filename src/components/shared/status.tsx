import type { AppointmentStatus, ClientStatus, PaymentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  WAITING: "Очікує",
  CONFIRMED: "Підтверджено",
  COMPLETED: "Завершено",
  CANCELLED: "Скасовано",
  NO_SHOW: "Не прийшов",
};

const APPOINTMENT_TONES = {
  WAITING: "warning",
  CONFIRMED: "brand",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "neutral",
} as const;

/** Кольори статусів для календаря — той самий словник, що й для бейджів. */
export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  WAITING: "var(--warning)",
  CONFIRMED: "var(--primary)",
  COMPLETED: "var(--success)",
  CANCELLED: "var(--danger)",
  NO_SHOW: "var(--fg-subtle)",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge tone={APPOINTMENT_TONES[status]} dot>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  NEW: "Новий",
  ACTIVE: "Активний",
  VIP: "VIP",
  INACTIVE: "Неактивний",
  BLOCKED: "Заблокований",
};

const CLIENT_TONES = {
  NEW: "info",
  ACTIVE: "success",
  VIP: "purple",
  INACTIVE: "neutral",
  BLOCKED: "danger",
} as const;

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={CLIENT_TONES[status]}>{CLIENT_STATUS_LABELS[status]}</Badge>;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Оплачено",
  PENDING: "Очікує",
  REFUNDED: "Повернено",
};

const PAYMENT_TONES = { PAID: "success", PENDING: "warning", REFUNDED: "neutral" } as const;

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONES[status]} dot>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Готівка",
  CARD: "Картка",
  ONLINE: "Онлайн",
  TRANSFER: "Переказ",
  CERTIFICATE: "Сертифікат",
};

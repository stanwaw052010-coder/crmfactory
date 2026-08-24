"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { CreditCard, MoreHorizontal, Plus, RotateCcw, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import {
  PaymentStatusBadge,
  PAYMENT_METHOD_LABELS,
} from "@/components/shared/status";
import {
  createPaymentAction,
  deletePaymentAction,
  updatePaymentStatusAction,
} from "@/server/actions/payments";
import { currencySymbol, formatMoney } from "@/lib/money";
import { formatDateUk, toDateKey } from "@/lib/time";
import type { PaymentStatus } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";

export type SaleRow = {
  id: string;
  paidAt: Date;
  amountCents: number;
  method: string;
  status: PaymentStatus;
  note: string | null;
  client: { id: string; firstName: string; lastName: string | null } | null;
  employee: { id: string; name: string } | null;
  service: { name: string } | null;
};

const STATUS_FILTERS = [
  { value: "ALL", label: "Усі" },
  { value: "PAID", label: "Оплачені" },
  { value: "PENDING", label: "Очікують" },
  { value: "REFUNDED", label: "Повернення" },
];

export function SalesTable({
  rows,
  total,
  page,
  pageSize,
  status,
  currency,
  canManage,
  clients,
  employees,
}: {
  rows: SaleRow[];
  total: number;
  page: number;
  pageSize: number;
  status: string;
  currency: string;
  canManage: boolean;
  clients: { id: string; firstName: string; lastName: string | null }[];
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [, formAction] = useActionState(
    async (prev: ActionResult<null> | null, formData: FormData) => {
      const result = await createPaymentAction(prev, formData);
      if (result.ok) {
        toast.success("Продаж додано");
        setModalOpen(false);
        router.refresh();
      } else {
        toast.error("Не вдалося зберегти", result.error);
      }
      return result;
    },
    null,
  );

  const setParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const changeStatus = async (id: string, next: PaymentStatus) => {
    const result = await updatePaymentStatusAction(id, next);
    if (result.ok) {
      toast.success("Статус оновлено");
      router.refresh();
    } else {
      toast.error("Не вдалося оновити", result.error);
    }
  };

  const remove = async (id: string) => {
    const result = await deletePaymentAction(id);
    if (result.ok) {
      toast.success("Запис видалено");
      router.refresh();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          size="sm"
          options={STATUS_FILTERS}
          value={status}
          onChange={(value) => setParams({ status: value === "ALL" ? null : value, page: null })}
        />
        {canManage && (
          <Button size="sm" className="ml-auto" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Додати продаж
          </Button>
        )}
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={status === "ALL" ? "Продажів ще немає" : "Нічого не знайдено"}
            description="Позначайте записи як «Завершено» — продаж створюється автоматично. Або додайте оплату вручну."
            action={
              canManage ? (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Додати продаж
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    {["Дата", "Клієнт", "Послуга", "Співробітник", "Спосіб"].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase"
                      >
                        {label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-[11.5px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase">
                      Сума
                    </th>
                    <th className="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase">
                      Статус
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)]">
                        {formatDateUk(row.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        {row.client ? (
                          <Link
                            href={`/clients/${row.client.id}`}
                            className="font-medium text-[var(--fg)] hover:text-[var(--primary)]"
                          >
                            {row.client.firstName} {row.client.lastName ?? ""}
                          </Link>
                        ) : (
                          <span className="text-[var(--fg-subtle)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)]">
                        {row.service?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)]">
                        {row.employee?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)]">
                        {PAYMENT_METHOD_LABELS[row.method] ?? row.method}
                      </td>
                      <td className="px-4 py-3 text-right text-[13.5px] font-semibold text-[var(--fg)] tabular-nums">
                        {formatMoney(row.amountCents, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        {canManage && (
                          <Dropdown
                            width="w-48"
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                aria-label="Дії"
                                className="rounded-lg p-1.5 text-[var(--fg-subtle)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] focus:opacity-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          >
                            {(close) => (
                              <>
                                {row.status !== "PAID" && (
                                  <DropdownItem
                                    icon={Check}
                                    onClick={() => {
                                      close();
                                      void changeStatus(row.id, "PAID");
                                    }}
                                  >
                                    Позначити оплаченим
                                  </DropdownItem>
                                )}
                                {row.status !== "REFUNDED" && (
                                  <DropdownItem
                                    icon={RotateCcw}
                                    onClick={() => {
                                      close();
                                      void changeStatus(row.id, "REFUNDED");
                                    }}
                                  >
                                    Оформити повернення
                                  </DropdownItem>
                                )}
                                <DropdownItem
                                  icon={Trash2}
                                  danger
                                  onClick={() => {
                                    close();
                                    void remove(row.id);
                                  }}
                                >
                                  Видалити
                                </DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(next) => setParams({ page: next === 1 ? null : String(next) })}
            />
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title="Новий продаж"
        description="Оплата, не прив'язана до запису — наприклад, продаж товару чи сертифіката"
      >
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сума" hint={currencySymbol(currency)}>
              <Input name="amount" inputMode="decimal" required autoFocus placeholder="35" />
            </Field>
            <Field label="Дата">
              <Input name="paidAt" type="date" defaultValue={toDateKey(new Date())} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Клієнт" hint="необов'язково">
              <Select name="clientId" defaultValue="">
                <option value="">Не вказано</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.firstName} {client.lastName ?? ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Співробітник" hint="необов'язково">
              <Select name="employeeId" defaultValue="">
                <option value="">Не вказано</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Спосіб оплати">
              <Select name="method" defaultValue="CASH">
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Статус">
              <Select name="status" defaultValue="PAID">
                <option value="PAID">Оплачено</option>
                <option value="PENDING">Очікує</option>
                <option value="REFUNDED">Повернено</option>
              </Select>
            </Field>
          </div>

          <Field label="Коментар" hint="необов'язково">
            <Textarea name="note" rows={2} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Скасувати
            </Button>
            <SubmitButton>Додати продаж</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

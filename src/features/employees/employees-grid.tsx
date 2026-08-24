"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, MoreHorizontal, Pencil, Trash2, UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { minutesToTime } from "@/lib/time";
import { EmployeeModal, type EmployeeFormValues } from "@/features/employees/employee-modal";
import { deleteEmployeeAction } from "@/server/actions/employees";

export type EmployeeCard = EmployeeFormValues & {
  id: string;
  avatarUrl: string | null;
  appointments: number;
  revenueCents: number;
  today: { isDayOff: boolean; startMinute: number; endMinute: number } | null;
  serviceCount: number;
};

export function EmployeesGrid({
  employees,
  services,
  currency,
  canManage,
  openNew,
}: {
  employees: EmployeeCard[];
  services: { id: string; name: string; color: string }[];
  currency: string;
  canManage: boolean;
  openNew: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [modalOpen, setModalOpen] = React.useState(openNew);
  const [editing, setEditing] = React.useState<EmployeeFormValues | null>(null);
  const [deleting, setDeleting] = React.useState<EmployeeCard | null>(null);
  const [pending, setPending] = React.useState(false);

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    const result = await deleteEmployeeAction(deleting.id);
    setPending(false);
    setDeleting(null);
    if (result.ok) toast.success("Співробітника видалено");
    else toast.info("Профіль деактивовано", result.error);
    router.refresh();
  };

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Додати співробітника
          </Button>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserRound}
            title="Команда порожня"
            description="Додайте співробітників — у кожного буде власний графік, послуги та статистика доходу."
            action={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Додати співробітника
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className={cn(
                "card group p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]",
                !employee.isActive && "opacity-65",
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={employee.name}
                  src={employee.avatarUrl}
                  color={employee.color}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/employees/${employee.id}`}
                    className="block truncate text-[15px] font-semibold text-[var(--fg)] hover:text-[var(--primary)]"
                  >
                    {employee.name}
                  </Link>
                  <p className="mt-0.5 truncate text-[12.5px] text-[var(--fg-muted)]">
                    {employee.position ?? "Співробітник"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!employee.isActive && <Badge tone="neutral">Неактивний</Badge>}
                    {employee.acceptsOnlineBooking && (
                      <Badge tone="success" dot>
                        Онлайн
                      </Badge>
                    )}
                    <Badge tone="neutral">{employee.serviceCount} послуг</Badge>
                  </div>
                </div>

                {canManage && (
                  <Dropdown
                    width="w-48"
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        aria-label="Дії"
                        className="shrink-0 rounded-lg p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <Link href={`/employees/${employee.id}`} onClick={close}>
                          <DropdownItem icon={CalendarClock}>Профіль і графік</DropdownItem>
                        </Link>
                        <DropdownItem
                          icon={Pencil}
                          onClick={() => {
                            close();
                            setEditing(employee);
                            setModalOpen(true);
                          }}
                        >
                          Редагувати
                        </DropdownItem>
                        <DropdownItem
                          icon={Trash2}
                          danger
                          onClick={() => {
                            close();
                            setDeleting(employee);
                          }}
                        >
                          Видалити
                        </DropdownItem>
                      </>
                    )}
                  </Dropdown>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
                <div>
                  <p className="text-[11px] text-[var(--fg-subtle)]">Записів за 30 днів</p>
                  <p className="mt-0.5 text-[16px] font-semibold text-[var(--fg)] tabular-nums">
                    {employee.appointments}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--fg-subtle)]">Виручка</p>
                  <p className="mt-0.5 text-[16px] font-semibold text-[var(--fg)] tabular-nums">
                    {formatMoney(employee.revenueCents, currency, { compact: true })}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
                <span className="text-[12.5px] text-[var(--fg-muted)]">
                  {!employee.today || employee.today.isDayOff ? (
                    "Сьогодні вихідний"
                  ) : (
                    <>
                      Сьогодні{" "}
                      <span className="font-medium text-[var(--fg)] tabular-nums">
                        {minutesToTime(employee.today.startMinute)} —{" "}
                        {minutesToTime(employee.today.endMinute)}
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <EmployeeModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          if (searchParams.get("new")) router.replace("/employees");
        }}
        onSaved={() => router.refresh()}
        employee={editing}
        services={services}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={pending}
        title="Видалити співробітника?"
        description={`${deleting?.name ?? ""} буде видалено. Якщо в нього є історія записів — профіль просто стане неактивним, дані збережуться.`}
        confirmLabel="Видалити"
      />
    </>
  );
}

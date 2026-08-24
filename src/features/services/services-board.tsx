"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Copy, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { durationLabel } from "@/lib/time";
import { ServiceModal, type ServiceFormValues } from "@/features/services/service-modal";
import {
  createCategoryAction,
  deleteServiceAction,
  duplicateServiceAction,
} from "@/server/actions/services";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/errors";

export type ServiceItem = ServiceFormValues & {
  id: string;
  categoryName: string | null;
  employeeCount: number;
};

export function ServicesBoard({
  services,
  categories,
  employees,
  currency,
  canManage,
}: {
  services: ServiceItem[];
  categories: { id: string; name: string; color: string }[];
  employees: { id: string; name: string; position: string | null; color: string }[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceFormValues | null>(null);
  const [deleting, setDeleting] = React.useState<ServiceItem | null>(null);
  const [pending, setPending] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [categoryState, categoryAction] = useActionState(
    async (prev: ActionResult<null> | null, formData: FormData) => {
      const result = await createCategoryAction(prev, formData);
      if (result.ok) {
        toast.success("Категорію створено");
        setCategoryOpen(false);
        router.refresh();
      } else if (!result.fieldErrors) {
        toast.error("Не вдалося створити категорію", result.error);
      }
      return result;
    },
    null,
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((service) => {
      if (category !== "all" && service.categoryId !== category) return false;
      if (!q) return true;
      return service.name.toLowerCase().includes(q);
    });
  }, [services, search, category]);

  const duplicate = async (id: string) => {
    const result = await duplicateServiceAction(id);
    if (result.ok) {
      toast.success("Копію створено");
      router.refresh();
    } else {
      toast.error("Не вдалося дублювати", result.error);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    const result = await deleteServiceAction(deleting.id);
    setPending(false);
    setDeleting(null);
    if (result.ok) {
      toast.success("Послугу видалено");
    } else {
      toast.info("Послугу деактивовано", result.error);
    }
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук послуги…"
          className="w-full max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            Усі
          </FilterChip>
          {categories.map((item) => (
            <FilterChip
              key={item.id}
              active={category === item.id}
              onClick={() => setCategory(item.id)}
              color={item.color}
            >
              {item.name}
            </FilterChip>
          ))}
        </div>

        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCategoryOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Категорія</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Нова послуга
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Sparkles}
            title={services.length === 0 ? "Послуг ще немає" : "Нічого не знайдено"}
            description={
              services.length === 0
                ? "Додайте послуги з тривалістю та ціною — далі календар і онлайн-запис працюватимуть самі."
                : "Спробуйте змінити запит або обрати іншу категорію."
            }
            action={
              canManage && services.length === 0 ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Додати послугу
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((service) => (
            <div
              key={service.id}
              className={cn(
                "card group relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]",
                !service.isActive && "opacity-65",
              )}
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: service.color }}
                aria-hidden
              />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-[var(--fg)]">
                    {service.name}
                  </h3>
                  {service.categoryName && (
                    <p className="mt-0.5 text-[12px] text-[var(--fg-subtle)]">
                      {service.categoryName}
                    </p>
                  )}
                </div>

                {canManage && (
                  <Dropdown
                    width="w-44"
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
                        <DropdownItem
                          icon={Pencil}
                          onClick={() => {
                            close();
                            setEditing(service);
                            setModalOpen(true);
                          }}
                        >
                          Редагувати
                        </DropdownItem>
                        <DropdownItem
                          icon={Copy}
                          onClick={() => {
                            close();
                            void duplicate(service.id);
                          }}
                        >
                          Дублювати
                        </DropdownItem>
                        <DropdownItem
                          icon={Trash2}
                          danger
                          onClick={() => {
                            close();
                            setDeleting(service);
                          }}
                        >
                          Видалити
                        </DropdownItem>
                      </>
                    )}
                  </Dropdown>
                )}
              </div>

              {service.description && (
                <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
                  {service.description}
                </p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-4">
                <Metric icon={Clock} label="Тривалість" value={durationLabel(service.durationMin)} />
                <Metric
                  label="Ціна"
                  value={formatMoney(service.priceCents, currency)}
                  emphasize
                />
                <Metric icon={Users} label="Майстри" value={String(service.employeeCount)} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {!service.isActive && <Badge tone="neutral">Неактивна</Badge>}
                {service.onlineBooking ? (
                  <Badge tone="success" dot>
                    Онлайн-запис
                  </Badge>
                ) : (
                  <Badge tone="neutral">Тільки вручну</Badge>
                )}
                {service.bufferMin > 0 && (
                  <Badge tone="info">Пауза {service.bufferMin} хв</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => router.refresh()}
        service={editing}
        categories={categories}
        employees={employees}
        currency={currency}
      />

      <Modal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        size="sm"
        title="Нова категорія"
        description="Категорії допомагають групувати послуги в календарі та на сторінці запису"
      >
        <form action={categoryAction} className="space-y-4">
          <Field label="Назва" error={categoryState && !categoryState.ok ? categoryState.fieldErrors?.name : undefined}>
            <Input name="name" required autoFocus placeholder="Манікюр" />
          </Field>
          <Field label="Колір">
            <Input name="color" type="color" defaultValue="#2563EB" className="h-10 w-20 p-1" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" onClick={() => setCategoryOpen(false)}>
              Скасувати
            </Button>
            <SubmitButton>Створити</SubmitButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={pending}
        title="Видалити послугу?"
        description={`«${deleting?.name ?? ""}» буде видалено. Якщо послугу вже використано в записах, вона просто стане неактивною — історія збережеться.`}
        confirmLabel="Видалити"
      />
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  emphasize,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] text-[var(--fg-subtle)]">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-[13.5px] font-semibold tabular-nums",
          emphasize ? "text-[var(--primary)]" : "text-[var(--fg)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "border-transparent bg-[var(--primary)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]",
      )}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: active ? "white" : color }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

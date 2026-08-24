"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { ClientStatusBadge } from "@/components/shared/status";
import { ClientModal, type ClientFormValues } from "@/features/clients/client-modal";
import { deleteClientAction } from "@/server/actions/clients";
import { formatMoney } from "@/lib/money";
import { formatDateUk, relativeUk } from "@/lib/time";
import type { ClientRow } from "@/server/queries/clients";

const FILTERS = [
  { value: "ALL", label: "Усі" },
  { value: "ACTIVE", label: "Активні" },
  { value: "NEW", label: "Нові" },
  { value: "VIP", label: "VIP" },
  { value: "INACTIVE", label: "Неактивні" },
];

export function ClientsTable({
  rows,
  total,
  page,
  pageSize,
  query,
  status,
  canCreate,
  canUpdate,
  canDelete,
  canExport,
  currency,
  openNew,
}: {
  rows: ClientRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  status: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
  currency: string;
  openNew: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [search, setSearch] = React.useState(query);
  const debounced = useDebounced(search, 300);
  const [modalOpen, setModalOpen] = React.useState(openNew);
  const [editing, setEditing] = React.useState<ClientFormValues | null>(null);
  const [deleting, setDeleting] = React.useState<ClientRow | null>(null);
  const [pending, setPending] = React.useState(false);

  const setParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Пошук у URL — щоб стан сторінки можна було зберегти й поділитися.
  React.useEffect(() => {
    if (debounced === query) return;
    setParams({ q: debounced || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const remove = async () => {
    if (!deleting) return;
    setPending(true);
    const result = await deleteClientAction(deleting.id);
    setPending(false);
    if (result.ok) {
      toast.success("Клієнта видалено");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  const exportCsv = () => {
    const header = ["Ім'я", "Прізвище", "Телефон", "Email", "Статус", "Візити", "Сума"];
    const lines = rows.map((row) =>
      [
        row.firstName,
        row.lastName ?? "",
        row.phone ?? "",
        row.email ?? "",
        row.status,
        row.visits,
        (row.totalCents / 100).toFixed(2),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([`﻿${[header.join(","), ...lines].join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Файл сформовано", `${rows.length} клієнтів`);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук за іменем, телефоном або email…"
          className="w-full max-w-sm"
        />
        <SegmentedControl
          size="sm"
          options={FILTERS}
          value={status}
          onChange={(value) => setParams({ status: value === "ALL" ? null : value, page: null })}
        />
        <div className="ml-auto flex items-center gap-2">
          {canExport && rows.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Експорт</span>
            </Button>
          )}
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Додати клієнта
            </Button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query || status !== "ALL" ? "Нічого не знайдено" : "Клієнтська база порожня"}
            description={
              query || status !== "ALL"
                ? "Спробуйте змінити запит або скинути фільтри."
                : "Додайте першого клієнта — і система почне збирати історію візитів, суми та вподобання."
            }
            action={
              query || status !== "ALL" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setParams({ q: null, status: null, page: null });
                  }}
                >
                  Скинути фільтри
                </Button>
              ) : canCreate ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Додати клієнта
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <Th>Клієнт</Th>
                    <Th>Телефон</Th>
                    <Th>Останній візит</Th>
                    <Th>Наступний</Th>
                    <Th className="text-right">Візити</Th>
                    <Th className="text-right">Сума</Th>
                    <Th>Статус</Th>
                    <Th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-[var(--surface-hover)]">
                      <Td>
                        <Link href={`/clients/${row.id}`} className="flex items-center gap-3">
                          <Avatar name={`${row.firstName} ${row.lastName ?? ""}`} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-medium text-[var(--fg)]">
                              {row.firstName} {row.lastName ?? ""}
                            </span>
                            {row.tags.length > 0 && (
                              <span className="mt-0.5 flex gap-1">
                                {row.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} tone="neutral" className="px-1.5 py-0 text-[10.5px]">
                                    {tag}
                                  </Badge>
                                ))}
                              </span>
                            )}
                          </span>
                        </Link>
                      </Td>
                      <Td className="text-[13px] text-[var(--fg-muted)]">
                        {row.phone ? (
                          <a href={`tel:${row.phone}`} className="hover:text-[var(--primary)]">
                            {row.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-[13px] text-[var(--fg-muted)]">
                        {row.lastVisit ? formatDateUk(row.lastVisit) : "—"}
                      </Td>
                      <Td className="text-[13px]">
                        {row.nextVisit ? (
                          <span className="font-medium text-[var(--primary)]">
                            {relativeUk(row.nextVisit)}
                          </span>
                        ) : (
                          <span className="text-[var(--fg-subtle)]">—</span>
                        )}
                      </Td>
                      <Td className="text-right text-[13px] font-medium text-[var(--fg)] tabular-nums">
                        {row.visits}
                      </Td>
                      <Td className="text-right text-[13px] font-semibold text-[var(--fg)] tabular-nums">
                        {formatMoney(row.totalCents, currency)}
                      </Td>
                      <Td>
                        <ClientStatusBadge status={row.status} />
                      </Td>
                      <Td>
                        <Dropdown
                          width="w-44"
                          trigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              aria-label="Дії"
                              className="rounded-lg p-1.5 text-[var(--fg-subtle)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <Link href={`/clients/${row.id}`} onClick={close}>
                                <DropdownItem icon={Users}>Переглянути</DropdownItem>
                              </Link>
                              {canUpdate && (
                                <DropdownItem
                                  icon={Pencil}
                                  onClick={() => {
                                    close();
                                    setEditing({
                                      id: row.id,
                                      firstName: row.firstName,
                                      lastName: row.lastName,
                                      phone: row.phone,
                                      email: row.email,
                                      status: row.status,
                                      source: null,
                                      birthday: null,
                                      address: null,
                                      tags: row.tags,
                                      marketingOptIn: false,
                                    });
                                    setModalOpen(true);
                                  }}
                                >
                                  Редагувати
                                </DropdownItem>
                              )}
                              {canDelete && (
                                <DropdownItem
                                  icon={Trash2}
                                  danger
                                  onClick={() => {
                                    close();
                                    setDeleting(row);
                                  }}
                                >
                                  Видалити
                                </DropdownItem>
                              )}
                            </>
                          )}
                        </Dropdown>
                      </Td>
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

      <ClientModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          if (searchParams.get("new")) setParams({ new: null });
        }}
        onSaved={() => router.refresh()}
        client={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={pending}
        title="Видалити клієнта?"
        description={`${deleting?.firstName ?? ""} ${deleting?.lastName ?? ""} та вся історія візитів будуть видалені назавжди.`}
        confirmLabel="Видалити"
      />
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-[11.5px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}

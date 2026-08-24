"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  KanbanSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { currencySymbol, formatMoney, centsToInput } from "@/lib/money";
import { formatDateUk } from "@/lib/time";
import {
  convertLeadToClientAction,
  createLeadAction,
  deleteLeadAction,
  moveLeadAction,
  updateLeadAction,
} from "@/server/actions/leads";

export type Stage = {
  id: string;
  key: string;
  name: string;
  color: string;
  isWon: boolean;
};

export type Lead = {
  id: string;
  stageId: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  valueCents: number;
  note: string | null;
  position: number;
  clientId: string | null;
  serviceName: string | null;
  assignedToName: string | null;
  nextAppointment: Date | null;
};

export function PipelineBoard({
  stages,
  leads,
  services,
  employees,
  currency,
  canManage,
}: {
  stages: Stage[];
  leads: Lead[];
  services: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [defaultStage, setDefaultStage] = React.useState<string>(stages[0]?.id ?? "");
  const [optimistic, setOptimistic] = React.useState<Record<string, string>>({});

  const [state, formAction] = useActionState(
    async (prev: ActionResult<null> | null, formData: FormData) => {
      const result = editing
        ? await updateLeadAction(editing.id, prev, formData)
        : await createLeadAction(prev, formData);

      if (result.ok) {
        toast.success(editing ? "Заявку оновлено" : "Заявку створено");
        setModalOpen(false);
        setEditing(null);
        router.refresh();
      } else {
        toast.error("Не вдалося зберегти", result.error);
      }
      return result;
    },
    null,
  );

  const [seenLeads, setSeenLeads] = React.useState(leads);
  if (seenLeads !== leads) {
    setSeenLeads(leads);
    setOptimistic({});
  }

  const effectiveStage = (lead: Lead) => optimistic[lead.id] ?? lead.stageId;

  const byStage = React.useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const lead of leads) {
      const stageId = effectiveStage(lead);
      if (map.has(stageId)) map.get(stageId)!.push(lead);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, leads, optimistic]);

  const drop = async (stageId: string) => {
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (!lead || effectiveStage(lead) === stageId) return;

    setOptimistic((prev) => ({ ...prev, [lead.id]: stageId }));
    const position = byStage.get(stageId)?.length ?? 0;
    const result = await moveLeadAction({ id: lead.id, stageId, position });

    if (result.ok) {
      router.refresh();
    } else {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
      toast.error("Не вдалося перемістити", result.error);
    }
  };

  const convert = async (leadId: string) => {
    const result = await convertLeadToClientAction(leadId);
    if (result.ok) {
      toast.success("Клієнта створено", "Заявка тепер пов'язана з карткою клієнта");
      router.refresh();
    } else {
      toast.error("Не вдалося створити клієнта", result.error);
    }
  };

  const remove = async (leadId: string) => {
    const result = await deleteLeadAction(leadId);
    if (result.ok) {
      toast.success("Заявку видалено");
      router.refresh();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  if (stages.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={KanbanSquare} title="Воронку не налаштовано" />
      </div>
    );
  }

  const totalValue = leads.reduce((sum, lead) => sum + lead.valueCents, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-[var(--fg-muted)]">
          {leads.length} заявок на суму{" "}
          <span className="font-semibold text-[var(--fg)]">
            {formatMoney(totalValue, currency)}
          </span>
        </p>
        {canManage && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setDefaultStage(stages[0].id);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Нова заявка
          </Button>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="flex min-w-max gap-4">
          {stages.map((stage) => {
            const items = byStage.get(stage.id) ?? [];
            const stageValue = items.reduce((sum, lead) => sum + lead.valueCents, 0);

            return (
              <div
                key={stage.id}
                onDragOver={(event) => {
                  if (!dragId) return;
                  event.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage((prev) => (prev === stage.id ? null : prev))}
                onDrop={(event) => {
                  event.preventDefault();
                  void drop(stage.id);
                }}
                className={cn(
                  "flex w-[290px] shrink-0 flex-col rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] transition-colors",
                  overStage === stage.id && "border-[var(--primary)] bg-[var(--primary-soft)]",
                )}
              >
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: stage.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--fg)]">
                    {stage.name}
                  </span>
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--fg-muted)] tabular-nums">
                    {items.length}
                  </span>
                </div>

                {stageValue > 0 && (
                  <p className="px-4 pt-2 text-[11.5px] text-[var(--fg-subtle)]">
                    {formatMoney(stageValue, currency)}
                  </p>
                )}

                <div className="flex-1 space-y-2 p-2.5">
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[12.5px] text-[var(--fg-subtle)]">
                      Перетягніть заявку сюди
                    </p>
                  ) : (
                    items.map((lead) => (
                      <div
                        key={lead.id}
                        draggable={canManage}
                        onDragStart={() => setDragId(lead.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        className={cn(
                          "card group p-3 transition-shadow hover:shadow-[var(--shadow-lift)]",
                          canManage && "cursor-grab active:cursor-grabbing",
                          dragId === lead.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--fg)]">
                            {lead.name}
                          </p>
                          {canManage && (
                            <Dropdown
                              width="w-52"
                              trigger={({ toggle }) => (
                                <button
                                  type="button"
                                  onClick={toggle}
                                  aria-label="Дії"
                                  className="shrink-0 rounded-md p-1 text-[var(--fg-subtle)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] focus:opacity-100"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              )}
                            >
                              {(close) => (
                                <>
                                  <DropdownItem
                                    onClick={() => {
                                      close();
                                      setEditing(lead);
                                      setModalOpen(true);
                                    }}
                                  >
                                    Редагувати
                                  </DropdownItem>
                                  {!lead.clientId && (
                                    <DropdownItem
                                      icon={UserPlus}
                                      onClick={() => {
                                        close();
                                        void convert(lead.id);
                                      }}
                                    >
                                      Створити клієнта
                                    </DropdownItem>
                                  )}
                                  {lead.clientId && (
                                    <Link href={`/clients/${lead.clientId}`} onClick={close}>
                                      <DropdownItem icon={UserPlus}>Картка клієнта</DropdownItem>
                                    </Link>
                                  )}
                                  <Link href="/calendar?new=1" onClick={close}>
                                    <DropdownItem icon={CalendarPlus}>Створити запис</DropdownItem>
                                  </Link>
                                  <DropdownItem
                                    icon={Trash2}
                                    danger
                                    onClick={() => {
                                      close();
                                      void remove(lead.id);
                                    }}
                                  >
                                    Видалити
                                  </DropdownItem>
                                </>
                              )}
                            </Dropdown>
                          )}
                        </div>

                        {lead.serviceName && (
                          <p className="mt-1 truncate text-[12px] text-[var(--fg-muted)]">
                            {lead.serviceName}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {lead.valueCents > 0 && (
                            <span className="text-[13px] font-semibold text-[var(--primary)] tabular-nums">
                              {formatMoney(lead.valueCents, currency)}
                            </span>
                          )}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="flex items-center gap-1 text-[12px] text-[var(--fg-muted)] hover:text-[var(--primary)]"
                            >
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </a>
                          )}
                        </div>

                        {lead.nextAppointment && (
                          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--fg-subtle)]">
                            <CalendarPlus className="h-3 w-3" />
                            Наступний візит: {formatDateUk(lead.nextAppointment)}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {lead.source && <Badge tone="neutral">{lead.source}</Badge>}
                          {lead.assignedToName && <Badge tone="info">{lead.assignedToName}</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        size="md"
        title={editing ? "Редагувати заявку" : "Нова заявка"}
        description="Заявки з Instagram, Telegram чи дзвінків — щоб жодна не загубилась"
      >
        <form action={formAction} className="space-y-4">
          <Field label="Ім'я" error={state && !state.ok ? state.fieldErrors?.name : undefined}>
            <Input name="name" defaultValue={editing?.name ?? ""} required autoFocus placeholder="Анна" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон">
              <Input name="phone" type="tel" defaultValue={editing?.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={editing?.email ?? ""} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Етап">
              <Select name="stageId" defaultValue={editing?.stageId ?? defaultStage}>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Сума" hint={currencySymbol(currency)}>
              <Input
                name="value"
                inputMode="decimal"
                defaultValue={editing ? centsToInput(editing.valueCents) : "0"}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Послуга" hint="необов'язково">
              <Select name="serviceId" defaultValue="">
                <option value="">Не вказано</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Відповідальний" hint="необов'язково">
              <Select name="assignedToId" defaultValue="">
                <option value="">Не призначено</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Джерело" hint="звідки прийшла заявка">
            <Input name="source" defaultValue={editing?.source ?? ""} placeholder="Instagram Direct" />
          </Field>

          <Field label="Нотатка">
            <Textarea name="note" defaultValue={editing?.note ?? ""} rows={2} />
          </Field>

          {state && !state.ok && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
              }}
            >
              Скасувати
            </Button>
            <SubmitButton>{editing ? "Зберегти" : "Створити заявку"}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

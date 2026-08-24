"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { formatDateUk, minutesToTime, timeToMinutes, WEEKDAYS_UK } from "@/lib/time";
import {
  addScheduleExceptionAction,
  deleteScheduleExceptionAction,
  updateScheduleAction,
} from "@/server/actions/employees";
import type { ExceptionType } from "@prisma/client";

export type ScheduleDay = {
  weekday: number;
  isDayOff: boolean;
  startMinute: number;
  endMinute: number;
  breakStart: number | null;
  breakEnd: number | null;
};

export type ScheduleException = {
  id: string;
  date: Date;
  endDate: Date | null;
  type: ExceptionType;
  startMinute: number | null;
  endMinute: number | null;
  note: string | null;
};

const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  DAY_OFF: "Вихідний",
  VACATION: "Відпустка",
  SICK_LEAVE: "Лікарняний",
  CUSTOM_HOURS: "Особливі години",
};

// Тиждень показуємо з понеділка, але в БД 0 = неділя.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleEditor({
  employeeId,
  days,
  exceptions,
  canEdit,
}: {
  employeeId: string;
  days: ScheduleDay[];
  exceptions: ScheduleException[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [exceptionOpen, setExceptionOpen] = React.useState(false);
  const [exceptionType, setExceptionType] = React.useState<ExceptionType>("DAY_OFF");

  const [local, setLocal] = React.useState<Record<number, ScheduleDay>>(() =>
    Object.fromEntries(days.map((day) => [day.weekday, day])),
  );

  // Свіжі дані з сервера перекривають локальні незбережені правки.
  const [seenDays, setSeenDays] = React.useState(days);
  if (seenDays !== days) {
    setSeenDays(days);
    setLocal(Object.fromEntries(days.map((day) => [day.weekday, day])));
  }

  const [, formAction] = useActionState(
    async (prev: ActionResult<null> | null, formData: FormData) => {
      const result = await updateScheduleAction(prev, formData);
      if (result.ok) {
        toast.success("Графік збережено");
        router.refresh();
      } else {
        toast.error("Не вдалося зберегти графік", result.error);
      }
      return result;
    },
    null,
  );

  const [, exceptionAction] = useActionState(
    async (prev: ActionResult<null> | null, formData: FormData) => {
      const result = await addScheduleExceptionAction(prev, formData);
      if (result.ok) {
        toast.success("Виняток додано");
        setExceptionOpen(false);
        router.refresh();
      } else {
        toast.error("Не вдалося додати", result.error);
      }
      return result;
    },
    null,
  );

  const update = (weekday: number, patch: Partial<ScheduleDay>) => {
    setLocal((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...patch } }));
  };

  const copyToAll = () => {
    const monday = local[1];
    if (!monday) return;
    setLocal((prev) => {
      const next = { ...prev };
      for (const weekday of WEEK_ORDER) {
        if (weekday === 0) continue;
        next[weekday] = { ...monday, weekday };
      }
      return next;
    });
    toast.info("Скопійовано", "Понеділок застосовано до Пн–Сб. Не забудьте зберегти.");
  };

  const removeException = async (id: string) => {
    const result = await deleteScheduleExceptionAction(id);
    if (result.ok) {
      toast.success("Виняток видалено");
      router.refresh();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Робочі години"
          description="Календар і онлайн-запис пропонують час лише в межах цього графіка"
          action={
            canEdit ? (
              <Button variant="ghost" size="sm" onClick={copyToAll}>
                Пн → усі дні
              </Button>
            ) : undefined
          }
        />
        <form action={formAction}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <CardBody className="space-y-1">
            {WEEK_ORDER.map((weekday) => {
              const day = local[weekday];
              if (!day) return null;
              const hasBreak = day.breakStart != null && day.breakEnd != null;

              return (
                <div
                  key={weekday}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    day.isDayOff ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-hover)]",
                  )}
                >
                  <input type="hidden" name={`day-${weekday}-off`} value={day.isDayOff ? "on" : ""} />
                  <input type="hidden" name={`day-${weekday}-start`} value={day.startMinute} />
                  <input type="hidden" name={`day-${weekday}-end`} value={day.endMinute} />
                  {hasBreak && (
                    <>
                      <input type="hidden" name={`day-${weekday}-breakStart`} value={day.breakStart!} />
                      <input type="hidden" name={`day-${weekday}-breakEnd`} value={day.breakEnd!} />
                    </>
                  )}

                  <span className="w-24 shrink-0 text-[13.5px] font-medium text-[var(--fg)]">
                    {WEEKDAYS_UK[weekday]}
                  </span>

                  {canEdit && (
                    <Switch
                      checked={!day.isDayOff}
                      onCheckedChange={(value) => update(weekday, { isDayOff: !value })}
                    />
                  )}

                  {day.isDayOff ? (
                    <span className="text-[13px] text-[var(--fg-subtle)]">Вихідний</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          step={900}
                          disabled={!canEdit}
                          value={minutesToTime(day.startMinute)}
                          onChange={(e) => update(weekday, { startMinute: timeToMinutes(e.target.value) })}
                          className="h-8 w-[104px] text-[13px]"
                        />
                        <span className="text-[var(--fg-subtle)]">—</span>
                        <Input
                          type="time"
                          step={900}
                          disabled={!canEdit}
                          value={minutesToTime(day.endMinute)}
                          onChange={(e) => update(weekday, { endMinute: timeToMinutes(e.target.value) })}
                          className="h-8 w-[104px] text-[13px]"
                        />
                      </div>

                      {hasBreak ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-[var(--fg-subtle)]">Перерва</span>
                          <Input
                            type="time"
                            step={900}
                            disabled={!canEdit}
                            value={minutesToTime(day.breakStart!)}
                            onChange={(e) => update(weekday, { breakStart: timeToMinutes(e.target.value) })}
                            className="h-8 w-[104px] text-[13px]"
                          />
                          <Input
                            type="time"
                            step={900}
                            disabled={!canEdit}
                            value={minutesToTime(day.breakEnd!)}
                            onChange={(e) => update(weekday, { breakEnd: timeToMinutes(e.target.value) })}
                            className="h-8 w-[104px] text-[13px]"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => update(weekday, { breakStart: null, breakEnd: null })}
                              aria-label="Прибрати перерву"
                              className="rounded-md p-1 text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        canEdit && (
                          <button
                            type="button"
                            onClick={() => update(weekday, { breakStart: 780, breakEnd: 840 })}
                            className="text-[12.5px] font-medium text-[var(--primary)] hover:underline"
                          >
                            + перерва
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </CardBody>

          {canEdit && (
            <div className="flex justify-end border-t border-[var(--border)] px-5 py-3.5">
              <SubmitButton size="sm">Зберегти графік</SubmitButton>
            </div>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Винятки"
          description="Відпустки, лікарняні та особливі години на конкретні дати"
          action={
            canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => setExceptionOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Додати
              </Button>
            ) : undefined
          }
        />
        {exceptions.length === 0 ? (
          <CardBody>
            <div className="flex items-center gap-3 text-[13px] text-[var(--fg-muted)]">
              <CalendarOff className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
              Винятків немає — діє звичайний тижневий графік.
            </div>
          </CardBody>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {exceptions.map((exception) => (
              <li key={exception.id} className="flex items-center gap-3 px-5 py-3">
                <Badge tone={exception.type === "VACATION" ? "info" : "warning"}>
                  {EXCEPTION_LABELS[exception.type]}
                </Badge>
                <span className="text-[13.5px] font-medium text-[var(--fg)]">
                  {formatDateUk(exception.date)}
                  {exception.endDate && ` — ${formatDateUk(exception.endDate)}`}
                </span>
                {exception.type === "CUSTOM_HOURS" &&
                  exception.startMinute != null &&
                  exception.endMinute != null && (
                    <span className="text-[13px] text-[var(--fg-muted)] tabular-nums">
                      {minutesToTime(exception.startMinute)} — {minutesToTime(exception.endMinute)}
                    </span>
                  )}
                {exception.note && (
                  <span className="truncate text-[12.5px] text-[var(--fg-subtle)]">
                    {exception.note}
                  </span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeException(exception.id)}
                    aria-label="Видалити виняток"
                    className="ml-auto rounded-md p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={exceptionOpen}
        onClose={() => setExceptionOpen(false)}
        size="sm"
        title="Новий виняток"
        description="Ці дати випадуть із доступного часу для запису"
      >
        <form action={exceptionAction} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <Field label="Тип">
            <Select
              name="type"
              value={exceptionType}
              onChange={(e) => setExceptionType(e.target.value as ExceptionType)}
            >
              {Object.entries(EXCEPTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Дата від">
              <Input name="date" type="date" required />
            </Field>
            <Field label="Дата до" hint="необов'язково">
              <Input name="endDate" type="date" />
            </Field>
          </div>

          {exceptionType === "CUSTOM_HOURS" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Початок">
                <Select name="startMinute" defaultValue="600">
                  {Array.from({ length: 25 }, (_, i) => 480 + i * 30).map((minute) => (
                    <option key={minute} value={minute}>
                      {minutesToTime(minute)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Кінець">
                <Select name="endMinute" defaultValue="900">
                  {Array.from({ length: 25 }, (_, i) => 480 + i * 30).map((minute) => (
                    <option key={minute} value={minute}>
                      {minutesToTime(minute)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <Field label="Нотатка" hint="необов'язково">
            <Input name="note" placeholder="Причина" />
          </Field>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" onClick={() => setExceptionOpen(false)}>
              Скасувати
            </Button>
            <SubmitButton>Додати</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

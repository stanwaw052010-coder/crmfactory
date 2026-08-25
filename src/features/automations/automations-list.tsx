"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Trash2, Workflow, Zap } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn, pluralUk } from "@/lib/utils";
import { relativeUk } from "@/lib/time";
import {
  ACTION_LABELS,
  TRIGGER_LABELS,
  describeCondition,
  type AutomationAction,
  type AutomationCondition,
} from "@/lib/automation";
import {
  deleteAutomationAction,
  toggleAutomationAction,
} from "@/server/actions/automations";
import { AutomationEditor, type AutomationDraft } from "@/features/automations/automation-editor";
import type { AutomationTrigger } from "@prisma/client";

export type AutomationRow = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  runCount: number;
  lastRunAt: Date | null;
};

export type RunRow = {
  id: string;
  automationName: string;
  status: "MATCHED" | "SKIPPED" | "FAILED";
  detail: string | null;
  createdAt: Date;
};

/** Готові правила — щоб перше знайомство не починалося з порожнього екрана. */
const TEMPLATES: { name: string; draft: AutomationDraft }[] = [
  {
    name: "Позначати VIP після 15 візитів",
    draft: {
      name: "Позначати VIP після 15 візитів",
      trigger: "APPOINTMENT_COMPLETED",
      conditions: [{ type: "visitCount", op: "gte", value: 15 }],
      actions: [{ type: "setClientStatus", status: "VIP" }],
      isActive: true,
    },
  },
  {
    name: "Сповіщати про онлайн-записи",
    draft: {
      name: "Сповіщати про онлайн-записи",
      trigger: "APPOINTMENT_CREATED",
      conditions: [{ type: "source", value: "ONLINE" }],
      actions: [
        {
          type: "notify",
          title: "Онлайн-запис: {{клієнт}}",
          body: "{{послуга}} · {{дата}} · {{майстер}}",
        },
      ],
      isActive: true,
    },
  },
  {
    name: "Передзвонити після неявки",
    draft: {
      name: "Передзвонити після неявки",
      trigger: "APPOINTMENT_NO_SHOW",
      conditions: [],
      actions: [
        {
          type: "createLead",
          title: "Передзвонити {{клієнт}}",
          note: "Не прийшов на {{послуга}} — з'ясувати причину і перезаписати",
        },
      ],
      isActive: true,
    },
  },
];

export function AutomationsList({
  automations,
  runs,
  services,
  canManage,
  currency,
}: {
  automations: AutomationRow[];
  runs: RunRow[];
  services: { id: string; name: string }[];
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState<AutomationDraft | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const serviceName = React.useCallback(
    (id: string) => services.find((service) => service.id === id)?.name,
    [services],
  );

  const openNew = (draft?: AutomationDraft) => {
    setEditing(draft ?? null);
    setEditorOpen(true);
  };

  const toggle = async (row: AutomationRow, next: boolean) => {
    const result = await toggleAutomationAction(row.id, next);
    if (!result.ok) {
      toast.error("Не вдалося змінити", result.error);
      return;
    }
    router.refresh();
  };

  const remove = async (row: AutomationRow) => {
    const result = await deleteAutomationAction(row.id);
    if (!result.ok) {
      toast.error("Не вдалося видалити", result.error);
      return;
    }
    toast.success("Правило видалено");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Автоматизації"
          description="Коли станеться подія → якщо умови збігаються → виконати дії"
          action={
            canManage ? (
              <Button size="sm" onClick={() => openNew()}>
                <Zap className="h-3.5 w-3.5" />
                Нове правило
              </Button>
            ) : undefined
          }
        />

        {automations.length === 0 ? (
          <CardBody>
            <EmptyState
              compact
              icon={Workflow}
              title="Правил ще немає"
              description="Правило робить рутину само: позначає VIP, нагадує передзвонити, попереджає про онлайн-записи."
            />
            {canManage && (
              <div className="stagger mt-4 grid gap-2 sm:grid-cols-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => openNew(template.draft)}
                    className="rounded-xl border border-[var(--border)] p-3 text-left transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  >
                    <p className="text-[13px] font-medium text-[var(--fg)]">{template.name}</p>
                    <p className="mt-1 text-[11.5px] text-[var(--fg-subtle)]">
                      {TRIGGER_LABELS[template.draft.trigger as AutomationTrigger]}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {automations.map((row) => (
              <li key={row.id} className={cn("px-5 py-4", !row.isActive && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[var(--fg)]">{row.name}</p>

                    {/* Ланцюжок «коли → якщо → тоді» одним рядком: правило
                        має читатись без відкриття редактора. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                      <Chip tone="brand">{TRIGGER_LABELS[row.trigger]}</Chip>
                      {row.conditions.map((condition, index) => (
                        <React.Fragment key={index}>
                          <ArrowRight className="h-3 w-3 text-[var(--fg-subtle)]" />
                          <Chip>{describeCondition(condition, { serviceName, currency })}</Chip>
                        </React.Fragment>
                      ))}
                      {row.actions.map((action, index) => (
                        <React.Fragment key={`a-${index}`}>
                          <ArrowRight className="h-3 w-3 text-[var(--fg-subtle)]" />
                          <Chip tone="success">{ACTION_LABELS[action.type]}</Chip>
                        </React.Fragment>
                      ))}
                    </div>

                    <p className="mt-1.5 text-[11.5px] text-[var(--fg-subtle)]">
                      {row.runCount === 0
                        ? "Ще не спрацьовувало"
                        : `Спрацювало ${row.runCount} ${pluralUk(row.runCount, "раз", "рази", "разів")}${
                            row.lastRunAt ? ` · востаннє ${relativeUk(row.lastRunAt)}` : ""
                          }`}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={(value) => toggle(row, value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Змінити"
                        onClick={() =>
                          openNew({
                            id: row.id,
                            name: row.name,
                            trigger: row.trigger,
                            conditions: row.conditions,
                            actions: row.actions,
                            isActive: row.isActive,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Видалити"
                        onClick={() => remove(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Журнал — без нього автоматизація виглядає як магія, про яку
          неможливо сказати, працює вона чи ні. */}
      {runs.length > 0 && (
        <Card>
          <CardHeader title="Журнал спрацювань" description="Останні 20 подій" />
          <ul className="divide-y divide-[var(--border)]">
            {runs.map((run) => (
              <li key={run.id} className="flex items-start gap-3 px-5 py-2.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      run.status === "MATCHED"
                        ? "var(--success)"
                        : run.status === "FAILED"
                          ? "var(--danger)"
                          : "var(--fg-subtle)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[var(--fg)]">{run.automationName}</p>
                  {run.detail && (
                    <p className="text-[11.5px] text-[var(--fg-muted)]">{run.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11.5px] text-[var(--fg-subtle)]">
                  {relativeUk(run.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AutomationEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          toast.success("Правило збережено");
          router.refresh();
        }}
        automation={editing}
        services={services}
      />
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success";
}) {
  const styles = {
    neutral: "bg-[var(--surface-hover)] text-[var(--fg-muted)]",
    brand: "bg-[var(--primary-soft)] text-[var(--primary)]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
  }[tone];

  return (
    <span className={cn("rounded-md px-1.5 py-0.5 whitespace-nowrap", styles)}>{children}</span>
  );
}

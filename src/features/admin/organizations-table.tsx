"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Gift, MoreHorizontal, Sparkles, Undo2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { formatDateUk } from "@/lib/time";
import { PLAN_LABELS } from "@/lib/plans";
import { setOrganizationPlanAction } from "@/server/actions/admin";
import type { Plan } from "@prisma/client";

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: Date;
  plan: Plan;
  status: string;
  trialEndsAt: Date | null;
  ownerEmail: string | null;
  members: number;
  clients: number;
  appointments: number;
};

/** Готові варіанти видачі — щоб не заповнювати форму заради типової дії. */
const GRANTS: { label: string; plan: Plan; trialDays: number; icon: typeof Gift }[] = [
  { label: "Pro безкоштовно — 30 днів", plan: "PRO", trialDays: 30, icon: Gift },
  { label: "Pro безкоштовно — 90 днів", plan: "PRO", trialDays: 90, icon: Gift },
  { label: "Pro безкоштовно — рік", plan: "PRO", trialDays: 365, icon: Sparkles },
  { label: "Business — 90 днів", plan: "BUSINESS", trialDays: 90, icon: Gift },
];

export function OrganizationsTable({ organizations }: { organizations: AdminOrganization[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);

  const grant = async (org: AdminOrganization, plan: Plan, trialDays: number) => {
    setPending(org.id);
    const result = await setOrganizationPlanAction({
      organizationId: org.id,
      plan,
      trialDays,
    });
    setPending(null);

    if (result.ok) {
      toast.success(
        `${org.name}: ${PLAN_LABELS[plan]}`,
        trialDays > 0 ? `Безкоштовно на ${trialDays} днів` : "Без обмеження в часі",
      );
      router.refresh();
    } else {
      toast.error("Не вдалося змінити тариф", result.error);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Організації"
        description="Зареєстровані бізнеси та їхні тарифи"
      />

      {organizations.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Організацій ще немає"
          description="Щойно хтось зареєструє workspace, він з'явиться тут."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                {["Бізнес", "Власник", "Тариф", "Команда", "Клієнти", "Записи", "Створено"].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-[var(--fg-subtle)] uppercase"
                    >
                      {label}
                    </th>
                  ),
                )}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {organizations.map((org) => {
                const trialActive = org.trialEndsAt && org.trialEndsAt > new Date();
                return (
                  <tr
                    key={org.id}
                    className="group transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={org.name} src={org.logoUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-[var(--fg)]">
                            {org.name}
                          </p>
                          <Link
                            href={`/book/${org.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 truncate text-[11.5px] text-[var(--fg-subtle)] hover:text-[var(--primary)]"
                          >
                            /book/{org.slug}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[12.5px] text-[var(--fg-muted)]">
                      {org.ownerEmail ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={org.plan === "FREE" ? "neutral" : "brand"}>
                          {PLAN_LABELS[org.plan]}
                        </Badge>
                        {trialActive && (
                          <span className="text-[11px] text-[var(--fg-subtle)]">
                            до {formatDateUk(org.trialEndsAt!)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)] tabular-nums">
                      {org.members}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)] tabular-nums">
                      {org.clients}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--fg-muted)] tabular-nums">
                      {org.appointments}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[var(--fg-subtle)]">
                      {formatDateUk(org.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <Dropdown
                        width="w-60"
                        trigger={({ toggle }) => (
                          <button
                            type="button"
                            onClick={toggle}
                            aria-label={`Тариф для ${org.name}`}
                            disabled={pending === org.id}
                            className="rounded-lg p-1.5 text-[var(--fg-subtle)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus:opacity-100 disabled:opacity-50"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <DropdownLabel>Видати доступ</DropdownLabel>
                            {GRANTS.map((option) => (
                              <DropdownItem
                                key={option.label}
                                icon={option.icon}
                                onClick={() => {
                                  close();
                                  void grant(org, option.plan, option.trialDays);
                                }}
                              >
                                {option.label}
                              </DropdownItem>
                            ))}
                            <DropdownSeparator />
                            <DropdownItem
                              icon={Undo2}
                              onClick={() => {
                                close();
                                void grant(org, "FREE", 0);
                              }}
                            >
                              Повернути на Free
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

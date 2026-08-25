import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { conditionSchema, actionSchema } from "@/lib/automation";
import {
  AutomationsList,
  type AutomationRow,
  type RunRow,
} from "@/features/automations/automations-list";

export const metadata: Metadata = { title: "Автоматизації" };

/**
 * Умови й дії лежать у JSON, тож на виході з бази їх перевіряє та сама
 * схема, що й на вході. Правило, збережене старішою версією коду, не
 * зламає сторінку — воно просто втратить незрозумілі рядки.
 */
function parseList<T>(
  raw: unknown,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
): T[] {
  if (!Array.isArray(raw)) return [];
  const result: T[] = [];
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success && parsed.data !== undefined) result.push(parsed.data);
  }
  return result;
}

export default async function AutomationsPage() {
  const ctx = await requireViewPermission("settings.view");

  const [automations, runs, services] = await Promise.all([
    prisma.automation.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.automationRun.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { automation: { select: { name: true } } },
    }),
    prisma.service.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: AutomationRow[] = automations.map((automation) => ({
    id: automation.id,
    name: automation.name,
    trigger: automation.trigger,
    conditions: parseList(automation.conditions, conditionSchema),
    actions: parseList(automation.actions, actionSchema),
    isActive: automation.isActive,
    runCount: automation.runCount,
    lastRunAt: automation.lastRunAt,
  }));

  const runRows: RunRow[] = runs.map((run) => ({
    id: run.id,
    automationName: run.automation.name,
    status: run.status,
    detail: run.detail,
    createdAt: run.createdAt,
  }));

  return (
    <AutomationsList
      automations={rows}
      runs={runRows}
      services={services}
      canManage={ctx.permissions.has("settings.manage")}
      currency={ctx.organization.currency}
    />
  );
}

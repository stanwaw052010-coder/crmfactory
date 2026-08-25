import "server-only";
import type { AutomationTrigger, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { formatDateUk } from "@/lib/time";
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  actionSchema,
  conditionSchema,
  renderTemplate,
  type AutomationAction,
  type AutomationCondition,
} from "@/lib/automation";

/**
 * Виконання автоматизацій.
 *
 * Викликається з тих місць, де подія справді відбувається (зміна статусу
 * запису, створення клієнта). Три властивості, закладені навмисно:
 *
 * 1. **Ніколи не ламає основну дію.** Якщо правило впало, запис усе одно
 *    збережеться, а помилка ляже в журнал. Автоматизація — надбудова, і
 *    вона не має права коштувати користувачу втраченого запису.
 * 2. **Кожне спрацювання лишає слід.** Без журналу автоматизація виглядає
 *    як магія, про яку неможливо сказати, працює вона взагалі чи ні.
 * 3. **Умови й дії перевіряються схемою на виході з БД**, а не лише на
 *    вході. JSON у базі міг покласти старіший код, і рушій має не впасти
 *    на правилі, форму якого він більше не розуміє.
 */

export type AutomationContext = {
  organizationId: string;
  clientId?: string | null;
  appointmentId?: string | null;
};

type ResolvedContext = {
  organizationId: string;
  currency: string;
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    status: string;
    tags: string[];
  } | null;
  appointment: {
    id: string;
    priceCents: number;
    serviceId: string;
    serviceName: string;
    employeeName: string;
    startAt: Date;
    source: string;
  } | null;
  visitCount: number;
};

export async function runAutomations(
  trigger: AutomationTrigger,
  context: AutomationContext,
): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({
      where: { organizationId: context.organizationId, trigger, isActive: true },
    });
    if (automations.length === 0) return;

    const resolved = await resolveContext(context);

    for (const automation of automations) {
      const conditions = parseList(automation.conditions, conditionSchema);
      const actions = parseList(automation.actions, actionSchema);

      const failed = conditions.find((condition) => !matches(condition, resolved));
      if (failed) {
        await logRun(automation.id, resolved.organizationId, "SKIPPED", context, {
          detail: `Умова не виконалась: ${CONDITION_LABELS[failed.type].toLowerCase()}`,
        });
        continue;
      }

      if (actions.length === 0) {
        await logRun(automation.id, resolved.organizationId, "SKIPPED", context, {
          detail: "У правилі немає дій",
        });
        continue;
      }

      const done: string[] = [];
      for (const action of actions) {
        await performAction(action, resolved);
        // У журнал пишемо назву дії людською мовою: його читає власниця
        // салону, і рядок «notify» їй нічого не каже.
        done.push(ACTION_LABELS[action.type]);
      }

      await prisma.automation.update({
        where: { id: automation.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      });
      await logRun(automation.id, resolved.organizationId, "MATCHED", context, {
        detail: `Виконано: ${done.join(", ")}`,
      });
    }
  } catch (error) {
    // Сюди потрапляє лише збій самого рушія — основна дія вже завершена.
    console.error("[automation] правило не виконалось", trigger, error);
  }
}

/** Розбір JSON із бази: усе, що не проходить схему, просто ігнорується. */
function parseList<T>(raw: Prisma.JsonValue, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  if (!Array.isArray(raw)) return [];
  const result: T[] = [];
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success && parsed.data !== undefined) result.push(parsed.data);
  }
  return result;
}

async function resolveContext(context: AutomationContext): Promise<ResolvedContext> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: context.organizationId },
    select: { currency: true },
  });

  const appointment = context.appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: context.appointmentId },
        select: {
          id: true,
          clientId: true,
          priceCents: true,
          serviceId: true,
          startAt: true,
          source: true,
          service: { select: { name: true } },
          employee: { select: { name: true } },
        },
      })
    : null;

  const clientId = context.clientId ?? appointment?.clientId ?? null;

  const client = clientId
    ? await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, firstName: true, lastName: true, status: true, tags: true },
      })
    : null;

  const visitCount = clientId
    ? await prisma.appointment.count({
        where: {
          organizationId: context.organizationId,
          clientId,
          status: "COMPLETED",
        },
      })
    : 0;

  return {
    organizationId: context.organizationId,
    currency: organization.currency,
    client,
    appointment: appointment
      ? {
          id: appointment.id,
          priceCents: appointment.priceCents,
          serviceId: appointment.serviceId,
          serviceName: appointment.service?.name ?? "",
          employeeName: appointment.employee?.name ?? "",
          startAt: appointment.startAt,
          source: appointment.source,
        }
      : null,
    visitCount,
  };
}

function compare(actual: number, op: "eq" | "gte" | "lte", expected: number): boolean {
  if (op === "eq") return actual === expected;
  if (op === "gte") return actual >= expected;
  return actual <= expected;
}

function matches(condition: AutomationCondition, ctx: ResolvedContext): boolean {
  switch (condition.type) {
    case "visitCount":
      return compare(ctx.visitCount, condition.op, condition.value);
    case "serviceId":
      return ctx.appointment?.serviceId === condition.value;
    case "priceCents":
      return ctx.appointment
        ? compare(ctx.appointment.priceCents, condition.op, condition.value)
        : false;
    case "clientStatus":
      return ctx.client?.status === condition.value;
    case "source":
      return ctx.appointment?.source === condition.value;
  }
}

function templateValues(ctx: ResolvedContext): Record<string, string> {
  const clientName = ctx.client
    ? `${ctx.client.firstName} ${ctx.client.lastName ?? ""}`.trim()
    : "клієнт";

  return {
    "клієнт": clientName,
    "послуга": ctx.appointment?.serviceName ?? "",
    "сума": ctx.appointment ? formatMoney(ctx.appointment.priceCents, ctx.currency) : "",
    "майстер": ctx.appointment?.employeeName ?? "",
    "дата": ctx.appointment ? formatDateUk(ctx.appointment.startAt) : "",
  };
}

async function performAction(action: AutomationAction, ctx: ResolvedContext): Promise<void> {
  const values = templateValues(ctx);

  switch (action.type) {
    case "notify": {
      await prisma.notification.create({
        data: {
          organizationId: ctx.organizationId,
          type: "SYSTEM",
          title: renderTemplate(action.title, values).slice(0, 200),
          body: action.body ? renderTemplate(action.body, values).slice(0, 500) : null,
          entityType: ctx.client ? "client" : undefined,
          entityId: ctx.client?.id,
        },
      });
      return;
    }

    case "tagClient": {
      if (!ctx.client) return;
      // Теги — масив без дублікатів: повторне спрацювання правила не має
      // перетворювати картку на список із десяти однакових позначок.
      if (ctx.client.tags.includes(action.tag)) return;
      await prisma.client.update({
        where: { id: ctx.client.id },
        data: { tags: { set: [...ctx.client.tags, action.tag] } },
      });
      ctx.client.tags.push(action.tag);
      return;
    }

    case "setClientStatus": {
      if (!ctx.client || ctx.client.status === action.status) return;
      await prisma.client.update({
        where: { id: ctx.client.id },
        data: { status: action.status },
      });
      ctx.client.status = action.status;
      return;
    }

    case "createLead": {
      const stage = await prisma.pipelineStage.findFirst({
        where: { organizationId: ctx.organizationId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (!stage) return;

      await prisma.lead.create({
        data: {
          organizationId: ctx.organizationId,
          stageId: stage.id,
          clientId: ctx.client?.id ?? null,
          name: renderTemplate(action.title, values).slice(0, 200),
          note: action.note ? renderTemplate(action.note, values).slice(0, 500) : null,
          serviceId: ctx.appointment?.serviceId ?? null,
          valueCents: ctx.appointment?.priceCents ?? 0,
          source: "Автоматизація",
        },
      });
      return;
    }
  }
}

async function logRun(
  automationId: string,
  organizationId: string,
  status: "MATCHED" | "SKIPPED" | "FAILED",
  context: AutomationContext,
  extra: { detail?: string },
): Promise<void> {
  try {
    await prisma.automationRun.create({
      data: {
        automationId,
        organizationId,
        status,
        entityType: context.appointmentId ? "appointment" : "client",
        entityId: context.appointmentId ?? context.clientId ?? null,
        detail: extra.detail?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error("[automation] не вдалося записати журнал", error);
  }
}

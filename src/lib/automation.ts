import { z } from "zod";
import type { AutomationTrigger } from "@prisma/client";

/**
 * Автоматизації: «Коли → Якщо → Тоді».
 *
 * Цей файл — єдине джерело правди і для конструктора в інтерфейсі, і для
 * рушія, що виконує правила, і для перевірки на вході. Якби опис умов жив
 * окремо від їх виконання, вони розійшлися б на першій же зміні, і
 * користувач зміг би зібрати правило, яке нічого не робить.
 *
 * Свідомо ОДИН тригер, набір умов «усі разом» і список дій — без гілок і
 * циклів. Візуальний конструктор із розгалуженнями виглядає солідно, але
 * власниця салону не збирає в ньому графи: їй треба «після завершеного
 * візиту познач VIP і нагадай написати». Складніші сценарії доцільно
 * додавати тоді, коли по цих буде видно, чого справді бракує.
 */

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  APPOINTMENT_CREATED: "Створено запис",
  APPOINTMENT_COMPLETED: "Візит завершено",
  APPOINTMENT_CANCELLED: "Запис скасовано",
  APPOINTMENT_NO_SHOW: "Клієнт не прийшов",
  CLIENT_CREATED: "З'явився новий клієнт",
};

export const TRIGGER_HINTS: Record<AutomationTrigger, string> = {
  APPOINTMENT_CREATED: "Щойно запис потрапив у календар — з CRM або з онлайн-запису",
  APPOINTMENT_COMPLETED: "Коли візит позначено завершеним",
  APPOINTMENT_CANCELLED: "Коли запис скасовано",
  APPOINTMENT_NO_SHOW: "Коли клієнта позначено як такого, що не прийшов",
  CLIENT_CREATED: "Коли картку клієнта створено вперше",
};

/** Тригери, у контексті яких є запис (а отже, послуга й сума). */
export const APPOINTMENT_TRIGGERS: AutomationTrigger[] = [
  "APPOINTMENT_CREATED",
  "APPOINTMENT_COMPLETED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_NO_SHOW",
];

// ── Умови ───────────────────────────────────────────────────────────────

const comparison = z.enum(["eq", "gte", "lte"]);
export type Comparison = z.infer<typeof comparison>;

export const COMPARISON_LABELS: Record<Comparison, string> = {
  eq: "дорівнює",
  gte: "не менше",
  lte: "не більше",
};

export const conditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("visitCount"),
    op: comparison,
    value: z.coerce.number().int().min(0).max(1000),
  }),
  z.object({ type: z.literal("serviceId"), value: z.string().min(1).max(64) }),
  z.object({
    type: z.literal("priceCents"),
    op: comparison,
    value: z.coerce.number().int().min(0).max(100_000_000),
  }),
  z.object({
    type: z.literal("clientStatus"),
    value: z.enum(["NEW", "ACTIVE", "VIP", "INACTIVE", "BLOCKED"]),
  }),
  z.object({ type: z.literal("source"), value: z.enum(["CRM", "ONLINE", "IMPORT"]) }),
]);

export type AutomationCondition = z.infer<typeof conditionSchema>;

export const CONDITION_LABELS: Record<AutomationCondition["type"], string> = {
  visitCount: "Кількість візитів клієнта",
  serviceId: "Послуга",
  priceCents: "Сума візиту",
  clientStatus: "Статус клієнта",
  source: "Звідки запис",
};

// ── Дії ─────────────────────────────────────────────────────────────────

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("notify"),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().max(400).optional(),
  }),
  z.object({ type: z.literal("tagClient"), tag: z.string().trim().min(1).max(24) }),
  z.object({
    type: z.literal("setClientStatus"),
    status: z.enum(["NEW", "ACTIVE", "VIP", "INACTIVE", "BLOCKED"]),
  }),
  z.object({
    type: z.literal("createLead"),
    title: z.string().trim().min(1).max(120),
    note: z.string().trim().max(400).optional(),
  }),
]);

export type AutomationAction = z.infer<typeof actionSchema>;

export const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  notify: "Створити сповіщення",
  tagClient: "Додати тег клієнту",
  setClientStatus: "Змінити статус клієнта",
  createLead: "Створити заявку у воронці",
};

export const ACTION_HINTS: Record<AutomationAction["type"], string> = {
  notify: "З'явиться у дзвіночку в шапці — побачить уся команда",
  tagClient: "Тег видно в картці клієнта і в фільтрах",
  setClientStatus: "Наприклад, автоматично позначати VIP після 15 візитів",
  createLead: "Заявка стане в першу колонку воронки — щоб не забути передзвонити",
};

export const automationSchema = z.object({
  name: z.string().trim().min(2, "Назва — від 2 символів").max(80),
  trigger: z.enum([
    "APPOINTMENT_CREATED",
    "APPOINTMENT_COMPLETED",
    "APPOINTMENT_CANCELLED",
    "APPOINTMENT_NO_SHOW",
    "CLIENT_CREATED",
  ]),
  conditions: z.array(conditionSchema).max(5, "Не більше п'яти умов"),
  actions: z.array(actionSchema).min(1, "Додайте хоча б одну дію").max(5),
  isActive: z.boolean().default(true),
});

export type AutomationInput = z.infer<typeof automationSchema>;

/**
 * Підстановка значень у текст: {{клієнт}}, {{послуга}}, {{сума}}, {{майстер}}.
 *
 * Плейсхолдери українською — їх пише власниця салону, а не програміст, і
 * `{{client}}` посеред українського речення виглядає як помилка.
 * Невідомий плейсхолдер лишається як є: краще побачити його в тексті й
 * виправити, ніж отримати мовчазну порожнечу.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{\s*([\p{L}_]+)\s*\}\}/gu, (match, key: string) => {
    const value = values[key.toLowerCase()];
    return value ?? match;
  });
}

export const TEMPLATE_KEYS = ["клієнт", "послуга", "сума", "майстер", "дата"] as const;

/** Опис умови людською мовою — для списку правил. */
export function describeCondition(
  condition: AutomationCondition,
  lookup: { serviceName?: (id: string) => string | undefined; currency?: string },
): string {
  switch (condition.type) {
    case "visitCount":
      return `візитів ${COMPARISON_LABELS[condition.op]} ${condition.value}`;
    case "serviceId":
      return `послуга — ${lookup.serviceName?.(condition.value) ?? "невідома"}`;
    case "priceCents":
      return `сума ${COMPARISON_LABELS[condition.op]} ${(condition.value / 100).toFixed(0)}`;
    case "clientStatus":
      return `статус клієнта — ${condition.value}`;
    case "source":
      return condition.value === "ONLINE" ? "запис онлайн" : `джерело — ${condition.value}`;
  }
}

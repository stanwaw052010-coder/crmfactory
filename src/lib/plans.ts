import type { Plan } from "@prisma/client";
import type { Permission } from "@/lib/permissions";

/**
 * Тарифи платформи — єдине джерело правди.
 *
 * Тут і ціни, і ліміти, і доступ до розділів. Раніше ціни дублювалися
 * в адмінці та на сторінці білінгу й устигли розійтися — тепер значення
 * одне на весь застосунок.
 *
 * Модель продажу — за кількістю співробітників, як у конкурентів.
 * Клієнтська база НЕ обмежується на жодному тарифі: ліміт на клієнтів
 * ламав би онлайн-запис (нового клієнта створює сама форма бронювання),
 * а бізнес не має втрачати заявки через тариф.
 */

export const PLAN_ORDER: Plan[] = ["FREE", "STARTER", "BUSINESS", "PRO"];

/** Порядковий номер — щоб порівнювати «тариф не нижче ніж». */
const PLAN_RANK: Record<Plan, number> = { FREE: 0, STARTER: 1, BUSINESS: 2, PRO: 3 };

export const PLAN_PRICE_CENTS: Record<Plan, number> = {
  FREE: 0,
  STARTER: 1400,
  BUSINESS: 2900,
  PRO: 5900,
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  STARTER: "Starter",
  BUSINESS: "Business",
  PRO: "Pro",
};

export const PLAN_TAGLINES: Record<Plan, string> = {
  FREE: "Щоб спробувати",
  STARTER: "Для невеликої студії",
  BUSINESS: "Для команди, що росте",
  PRO: "Для мережі салонів",
};

/** `null` означає «без обмежень». */
export type PlanLimits = {
  employees: number | null;
  workspaces: number | null;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { employees: 1, workspaces: 1 },
  STARTER: { employees: 3, workspaces: 1 },
  BUSINESS: { employees: 10, workspaces: 1 },
  PRO: { employees: null, workspaces: null },
};

/**
 * Розділи, доступні від певного тарифу.
 *
 * Свідомо НЕ обмежуємо: календар, клієнтів, послуги, онлайн-запис,
 * налаштування та білінг. Перші — це суть продукту (без них CRM не CRM),
 * останні два — шлях до апгрейду: власник, який не бачить сторінку тарифів,
 * не зможе заплатити.
 */
const PERMISSION_MIN_PLAN: Partial<Record<Permission, Plan>> = {
  "client.export": "STARTER",
  "pipeline.view": "STARTER",
  "pipeline.manage": "STARTER",
  "analytics.view": "BUSINESS",
  "team.manage": "BUSINESS",
};

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

/** Чи дозволяє тариф це право. Роль перевіряється окремо. */
export function planAllows(plan: Plan, permission: Permission): boolean {
  const required = PERMISSION_MIN_PLAN[permission];
  return required ? planAtLeast(plan, required) : true;
}

/** Мінімальний тариф, на якому право з'являється (для повідомлень в UI). */
export function requiredPlanFor(permission: Permission): Plan | null {
  return PERMISSION_MIN_PLAN[permission] ?? null;
}

export function employeeLimit(plan: Plan): number | null {
  return PLAN_LIMITS[plan].employees;
}

export const PLAN_FEATURES: Record<Plan, string[]> = {
  FREE: [
    "1 співробітник",
    "Клієнти без обмежень",
    "Календар і записи",
    "Сторінка онлайн-запису",
  ],
  STARTER: [
    "До 3 співробітників",
    "Усе з Free",
    "Воронка продажів",
    "Облік продажів",
    "Експорт клієнтів",
  ],
  BUSINESS: [
    "До 10 співробітників",
    "Усе зі Starter",
    "Повна аналітика",
    "Ролі та права доступу",
    "Нагадування клієнтам",
  ],
  PRO: [
    "Необмежена команда",
    "Усе з Business",
    "Кілька філій (workspace)",
    "Пріоритетна підтримка",
  ],
};

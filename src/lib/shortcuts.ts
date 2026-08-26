import type { Permission } from "@/lib/permissions";

/**
 * Гарячі клавіші.
 *
 * Префікс `g` («go to») — той самий, що в Gmail і GitHub: людина, яка
 * працює в CRM цілий день, уже знає цю звичку, і вчити її нема потреби.
 *
 * Список — єдине джерело правди і для обробника, і для довідки по «?».
 * Інакше вони розходяться на першій же зміні, і довідка починає брехати.
 */

export type Shortcut = {
  /** Послідовність клавіш: ["g", "c"] — спочатку g, потім c. */
  keys: string[];
  label: string;
  href?: string;
  permission?: Permission;
  group: "Навігація" | "Дії" | "Загальне";
};

export const SHORTCUTS: Shortcut[] = [
  { keys: ["g", "d"], label: "Головна", href: "/dashboard", permission: "dashboard.view", group: "Навігація" },
  { keys: ["g", "c"], label: "Записи", href: "/calendar", permission: "calendar.view", group: "Навігація" },
  { keys: ["g", "k"], label: "Клієнти", href: "/clients", permission: "client.view", group: "Навігація" },
  { keys: ["g", "s"], label: "Послуги", href: "/services", permission: "service.view", group: "Навігація" },
  { keys: ["g", "t"], label: "Команда", href: "/employees", permission: "employee.view", group: "Навігація" },
  { keys: ["g", "p"], label: "Воронка", href: "/pipeline", permission: "pipeline.view", group: "Навігація" },
  { keys: ["g", "a"], label: "Аналітика", href: "/analytics", permission: "analytics.view", group: "Навігація" },
  { keys: ["g", "v"], label: "Відгуки", href: "/reviews", permission: "review.view", group: "Навігація" },
  { keys: ["g", "n"], label: "Налаштування", href: "/settings", permission: "settings.view", group: "Навігація" },

  { keys: ["n"], label: "Новий запис", href: "/calendar?new=1", permission: "appointment.create", group: "Дії" },
  { keys: ["c"], label: "Новий клієнт", href: "/clients?new=1", permission: "client.create", group: "Дії" },

  { keys: ["/"], label: "Пошук", group: "Загальне" },
  { keys: ["?"], label: "Ця довідка", group: "Загальне" },
  { keys: ["Esc"], label: "Закрити вікно", group: "Загальне" },
];

export const SHORTCUT_GROUPS = ["Навігація", "Дії", "Загальне"] as const;

/**
 * Чи вводить користувач текст просто зараз.
 *
 * Без цієї перевірки «n» у полі імені клієнта відкидало б на сторінку
 * створення запису — найшвидший спосіб зробити гарячі клавіші ворогом.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.closest("[role='textbox']") !== null
  );
}

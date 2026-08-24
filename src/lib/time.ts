/**
 * Час у CRM.
 *
 * У БД усе зберігається в UTC. Робочі години та слоти рахуються
 * у «хвилинах від опівночі» (540 = 09:00) — це просто, детерміновано
 * і не залежить від переходу на літній час усередині дня.
 */

export const WEEKDAYS_UK = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
export const WEEKDAYS_SHORT_UK = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export const MONTHS_UK = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];
export const MONTHS_NOM_UK = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Тиждень починається з понеділка. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

export function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function endOfMonth(date: Date): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return endOfDay(d);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** "24 серпня" / "24 серпня 2026" */
export function formatDateUk(date: Date, opts?: { year?: boolean; weekday?: boolean }): string {
  const base = `${date.getDate()} ${MONTHS_UK[date.getMonth()]}`;
  const withYear = opts?.year ? `${base} ${date.getFullYear()}` : base;
  return opts?.weekday ? `${WEEKDAYS_UK[date.getDay()]}, ${withYear}` : withYear;
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDateTimeUk(date: Date): string {
  return `${formatDateUk(date)}, ${formatTime(date)}`;
}

/** yyyy-mm-dd у локальному часі (не UTC — важливо для календаря). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Комбінує дату та "HH:MM" у локальний Date. */
export function combineDateTime(dateKey: string, time: string): Date {
  const base = fromDateKey(dateKey);
  const [h, m] = time.split(":").map(Number);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

export function relativeUk(date: Date): string {
  const now = new Date();
  const diff = Math.round((date.getTime() - now.getTime()) / 60000);
  const abs = Math.abs(diff);
  if (abs < 1) return "щойно";
  if (abs < 60) return diff > 0 ? `через ${abs} хв` : `${abs} хв тому`;
  if (abs < 60 * 24) {
    const h = Math.round(abs / 60);
    return diff > 0 ? `через ${h} год` : `${h} год тому`;
  }
  const d = Math.round(abs / (60 * 24));
  if (d === 1) return diff > 0 ? "завтра" : "вчора";
  if (d < 7) return diff > 0 ? `через ${d} дн.` : `${d} дн. тому`;
  return formatDateUk(date, { year: date.getFullYear() !== now.getFullYear() });
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

export function greetingUk(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Доброї ночі";
  if (h < 12) return "Доброго ранку";
  if (h < 18) return "Доброго дня";
  return "Доброго вечора";
}

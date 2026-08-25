/**
 * Переклад «настінного» часу в справжній UTC.
 *
 * У базі час візиту зберігається як настінний годинник салону, покладений
 * у колонку типу timestamp: клієнт обрав 09:00 — у базі лежить
 * `2026-08-27T09:00:00.000Z`. Це НЕ дев'ята година за Гринвічем, це
 * «дев'ята на годиннику в салоні». Весь застосунок так само наївно й
 * показує ці значення назад, тож усередині все сходиться.
 *
 * Не сходиться воно рівно тоді, коли дані ЙДУТЬ НАЗОВНІ — у файл календаря
 * чи в лист. Календар клієнта читає `20260827T090000Z` буквально й ставить
 * подію на 12:00 за Києвом. Людина приходить на три години пізніше.
 *
 * Ця функція й закриває цей стик: бере настінний час, знає пояс салону
 * і повертає момент, який справді відповідає цьому годиннику.
 */

/** Зсув поясу в мілісекундах на конкретний момент (з урахуванням літнього часу). */
function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // О півночі деякі локалі дають 24 замість 0.
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

/**
 * @param wall дата, UTC-поля якої є настінним часом салону
 * @param timeZone пояс салону, напр. `Europe/Kyiv`
 */
export function wallClockToUtc(wall: Date, timeZone: string): Date {
  const naive = wall.getTime();
  // Два наближення: перше може помилитися на межі переведення годинників,
  // друге рахує зсув уже майже в потрібній точці й прибирає цю похибку.
  const first = new Date(naive - offsetMs(wall, timeZone));
  return new Date(naive - offsetMs(first, timeZone));
}

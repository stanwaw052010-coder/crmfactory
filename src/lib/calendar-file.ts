/**
 * Генерація .ics — файлу, який відкривається як подія в Google Calendar,
 * Apple Calendar, Outlook.
 *
 * Стандарт RFC 5545 вимагає двох речей, про які легко забути й отримати
 * файл, що мовчки не імпортується:
 *
 * 1. Екранування `\`, `;`, `,` і переносів рядка у текстових полях.
 * 2. Згортання рядків, довших за 75 октетів — рахувати треба саме байти,
 *    бо українська кирилиця у UTF-8 займає по два на символ, і наївний
 *    поділ по символах ріже рядок посеред літери.
 */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Згортання рядка до 75 октетів; продовження починається з пробілу. */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // Перший рядок — 75 октетів, наступні — 74 (перший займає пробіл).
    const limit = chunks.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);

    // Не ріжемо посеред UTF-8 послідовності: продовження мають вигляд 10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;

    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return chunks.join("\r\n ");
}

/** 2026-08-26T09:00:00.000Z → 20260826T090000Z */
function toIcsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export type CalendarEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
};

export function buildIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//crm.factory//Booking//UK",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.url ? [`URL:${escapeText(event.url)}`] : []),
    // Нагадування за годину — те, заради чого подію й додають у календар.
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF — вимога стандарту, з \n частина клієнтів файл не читає.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

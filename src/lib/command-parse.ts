/**
 * Розбір команд природною мовою для ⌘K.
 *
 * «запис для Анни завтра о 15:00» → дія «створити запис», ім'я «Анни»,
 * дата — завтра, час 15:00.
 *
 * Свідомо БЕЗ мовної моделі. Тут потрібна миттєва реакція на кожне
 * натискання клавіші, повна передбачуваність і нуль вартості за запит —
 * а набір формулювань, якими люди призначають зустрічі, насправді
 * невеликий. LLM тут дав би затримку й несподіванки замість користі.
 *
 * Розбираємо українську й російську: салони в Україні пишуть і так, і так,
 * часто в одному реченні.
 */

export type ParsedCommand = {
  intent: "appointment" | "client";
  /** Ім'я, витягнуте з фрази — підставляється в пошук клієнта. */
  name?: string;
  /** Дата у форматі YYYY-MM-DD. */
  date?: string;
  /** Час у форматі HH:MM. */
  time?: string;
  /** Людський опис розпізнаного — показуємо в підказці. */
  summary: string;
};

const APPOINTMENT_WORDS = [
  "запис", "записати", "записать", "запиши", "запись",
  "візит", "визит", "прийом", "прием",
];
const CLIENT_WORDS = ["клієнт", "клиент", "контакт"];

/** Слова, які не можуть бути іменем — щоб «на завтра» не стало «Завтра». */
const STOP_WORDS = new Set([
  "для", "на", "о", "в", "у", "до", "з", "с", "к",
  "завтра", "сьогодні", "сегодня", "післязавтра", "послезавтра",
  "новий", "новый", "нова", "новая", "нового", "нову",
  ...APPOINTMENT_WORDS,
  ...CLIENT_WORDS,
]);

/**
 * Дні тижня — за основою слова, а не точною формою.
 *
 * Українською пишуть «у п'ятницю», «в середу», «на вівторок»: називного
 * відмінка в реальній фразі майже не буває. Тому шукаємо основу, під яку
 * підпадають усі форми.
 */
const WEEKDAY_STEMS: [string[], number][] = [
  [["понеділ", "понедельн", "пн"], 1],
  [["вівтор", "вторник", "вт"], 2],
  [["серед", "среду", "среда", "ср"], 3],
  [["четвер", "четверг", "чт"], 4],
  [["п'ятниц", "п’ятниц", "пятниц", "пт"], 5],
  [["субот", "суббот", "сб"], 6],
  [["неділ", "недел", "воскресень", "нд"], 0],
];

/**
 * Пошук слова з урахуванням кирилиці.
 *
 * `\b` у JavaScript визначено через `\w`, тобто лише латиниця й цифри.
 * Між пробілом і літерою «з» межі слова НЕМАЄ, і `/\bзавтра\b/` не
 * збігається ніколи. Тому межі задаємо явно через `\p{L}` із прапорцем `u`.
 */
function wordPattern(word: string, exact: boolean): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = exact ? "(?![\\p{L}])" : "[\\p{L}']*(?![\\p{L}])";
  return new RegExp(`(?<![\\p{L}])${escaped}${tail}`, "iu");
}

function findWord(text: string, words: string[], exact = false): string | null {
  for (const word of words) {
    const match = text.match(wordPattern(word, exact));
    if (match) return match[0];
  }
  return null;
}

function toKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Час у фразі.
 *
 * Приймає «15:00», «15.00», «о 15», «в 9». Голе число розпізнається як
 * час лише після прийменника — інакше «записати 3 клієнтів» перетворилося б
 * на третю годину.
 */
function extractTime(text: string): { time: string; matched: string } | null {
  const explicit = text.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (explicit) {
    const hour = Number(explicit[1]);
    const minute = Number(explicit[2]);
    if (hour <= 23 && minute <= 59) {
      return {
        time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        matched: explicit[0],
      };
    }
  }

  const afterPreposition = text.match(/(?:^|\s)(?:о|у|в|на)\s+(\d{1,2})(?:\s*(?:год|година|часов|часа|ч))?\b/i);
  if (afterPreposition) {
    const hour = Number(afterPreposition[1]);
    if (hour >= 0 && hour <= 23) {
      return { time: `${String(hour).padStart(2, "0")}:00`, matched: afterPreposition[0].trim() };
    }
  }

  return null;
}

/** Дата у фразі: «завтра», «у п'ятницю», «26.08». */
function extractDate(text: string, now: Date): { date: string; matched: string; label: string } | null {
  const afterTomorrow = findWord(text, ["післязавтра", "послезавтра"]);
  if (afterTomorrow) {
    return { date: toKey(addDays(now, 2)), matched: afterTomorrow, label: "післязавтра" };
  }

  const tomorrow = findWord(text, ["завтра"]);
  if (tomorrow) {
    return { date: toKey(addDays(now, 1)), matched: tomorrow, label: "завтра" };
  }

  const today = findWord(text, ["сьогодні", "сегодня"]);
  if (today) {
    return { date: toKey(now), matched: today, label: "сьогодні" };
  }

  // Числова дата: 26.08 або 26/08
  const numeric = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = numeric[3] ? Number(numeric[3].padStart(4, "20")) : now.getFullYear();
      const parsed = new Date(year, month - 1, day);
      // Дата без року, що вже минула, означає наступний рік.
      if (!numeric[3] && parsed < now) parsed.setFullYear(year + 1);
      return { date: toKey(parsed), matched: numeric[0], label: numeric[0] };
    }
  }

  for (const [stems, weekday] of WEEKDAY_STEMS) {
    // Дволітерні скорочення шукаємо лише як окреме слово, щоб «ср»
    // не спрацювало всередині «середина».
    for (const stem of stems) {
      const matched = findWord(text, [stem], stem.length <= 2);
      if (!matched) continue;

      // Той самий день тижня означає наступний тиждень, а не сьогодні.
      let offset = (weekday - now.getDay() + 7) % 7;
      if (offset === 0) offset = 7;

      return { date: toKey(addDays(now, offset)), matched, label: `у ${matched.toLowerCase()}` };
    }
  }

  return null;
}

/** Ім'я — найдовше слово з великої літери, що не є службовим. */
function extractName(text: string): string | null {
  const words = text.split(/\s+/).filter(Boolean);
  const candidates = words.filter((word) => {
    const clean = word.replace(/[^\p{L}'’-]/gu, "");
    if (clean.length < 2) return false;
    if (STOP_WORDS.has(clean.toLowerCase())) return false;
    if (/\d/.test(word)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Ім'я в українській зазвичай стоїть після «для» / «на».
  const afterFor = text.match(/(?:для|на)\s+([\p{Lu}][\p{L}'’-]+)/u);
  if (afterFor) return afterFor[1];

  // Інакше — перше слово з великої літери.
  const capitalised = candidates.find((word) => /^[\p{Lu}]/u.test(word));
  return capitalised?.replace(/[^\p{L}'’-]/gu, "") ?? null;
}

export function parseCommand(input: string, now: Date = new Date()): ParsedCommand | null {
  const text = input.trim();
  if (text.length < 4) return null;

  const lower = text.toLowerCase();

  const isAppointment = APPOINTMENT_WORDS.some((word) => lower.includes(word));
  const isClient = !isAppointment && CLIENT_WORDS.some((word) => lower.includes(word));
  if (!isAppointment && !isClient) return null;

  const timeMatch = extractTime(text);
  const dateMatch = extractDate(text, now);

  // Ім'я шукаємо в тексті, з якого прибрано дату й час — інакше
  // «15:00» чи «п'ятницю» самі стануть кандидатами в імена.
  let rest = text;
  if (timeMatch) rest = rest.replace(timeMatch.matched, " ");
  if (dateMatch) rest = rest.replace(new RegExp(dateMatch.matched, "i"), " ");
  for (const word of [...APPOINTMENT_WORDS, ...CLIENT_WORDS]) {
    rest = rest.replace(new RegExp(`\\b${word}\\w*`, "gi"), " ");
  }

  const name = extractName(rest);

  const parts: string[] = [];
  if (name) parts.push(name);
  if (dateMatch) parts.push(dateMatch.label);
  if (timeMatch) parts.push(`о ${timeMatch.time}`);

  if (isClient) {
    return {
      intent: "client",
      name: name ?? undefined,
      summary: name ? `Створити клієнта: ${name}` : "Створити клієнта",
    };
  }

  return {
    intent: "appointment",
    name: name ?? undefined,
    date: dateMatch?.date,
    time: timeMatch?.time,
    summary: parts.length > 0 ? `Новий запис — ${parts.join(", ")}` : "Новий запис",
  };
}

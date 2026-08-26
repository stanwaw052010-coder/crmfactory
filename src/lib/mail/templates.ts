import "server-only";

/**
 * HTML-листи пишуться таблицями та інлайновими стилями — це не архаїзм,
 * а вимога поштових клієнтів (Outlook не підтримує flex/grid і <style>).
 *
 * ВАЖЛИВО про назву бренду в листі.
 *
 * `.factory` — справжня доменна зона, тому Gmail, Apple Mail і Outlook
 * бачать голий текст «crm.factory» як адресу сайту й самі роблять із
 * нього посилання. Виглядає воно як звичайне синє посилання зверху листа,
 * але веде не до нас: браузер іде шукати неіснуючий домен і викидає
 * користувача на випадковий чужий сайт. Людина при цьому впевнена, що
 * натиснула на наш логотип.
 *
 * Тому кожна згадка бренду в листі обгорнута у власний `<a>` з нашою
 * адресою: поштовий клієнт не чіпає текст, який уже є посиланням.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, body: string, appUrl: string): string {
  const home = encodeURI(appUrl);
  return `<!doctype html>
<html lang="uk">
<body style="margin:0;padding:0;background:#f6f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e9f2;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <a href="${home}" style="font-size:17px;font-weight:600;letter-spacing:-0.02em;color:#0f172a;text-decoration:none;">crm<span style="color:#2563eb;">.</span>factory</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:21px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:#0f172a;">${escapeHtml(title)}</h1>
              ${body}
            </td>
          </tr>
        </table>
        <p style="max-width:520px;margin:16px auto 0 auto;font-size:12px;line-height:1.6;color:#94a3b8;">
          Цей лист надіслано автоматично сервісом
          <a href="${home}" style="color:#94a3b8;text-decoration:none;">crm<span style="color:#94a3b8;">.</span>factory</a>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetEmail(params: {
  name: string;
  url: string;
  minutes: number;
  /** Адреса застосунку — щоб назва бренду в листі вела саме до нас. */
  appUrl: string;
}) {
  const safeUrl = encodeURI(params.url);
  const html = shell(
    "Відновлення пароля",
    `<p style="margin:0 0 20px 0;font-size:14.5px;line-height:1.65;color:#475569;">
       Вітаємо, ${escapeHtml(params.name)}! Ми отримали запит на зміну пароля до вашого акаунта.
       Натисніть кнопку нижче — посилання дійсне ${params.minutes} хвилин і спрацює лише один раз.
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
       <tr>
         <td style="background:#2563eb;border-radius:10px;">
           <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-size:14.5px;font-weight:600;color:#ffffff;text-decoration:none;">Задати новий пароль</a>
         </td>
       </tr>
     </table>
     <p style="margin:0 0 8px 0;font-size:12.5px;line-height:1.6;color:#94a3b8;">Якщо кнопка не працює, скопіюйте це посилання:</p>
     <p style="margin:0 0 20px 0;font-size:12.5px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#2563eb;">${escapeHtml(params.url)}</a></p>
     <p style="margin:0;padding-top:20px;border-top:1px solid #e3e9f2;font-size:12.5px;line-height:1.6;color:#94a3b8;">
       Не ви робили цей запит? Просто проігноруйте лист — пароль лишиться попереднім.
     </p>`,
    params.appUrl,
  );

  const text = [
    `Вітаємо, ${params.name}!`,
    "",
    // Без голого «crm.factory» у реченні: у плейн-тексті поштовий клієнт
    // теж зробив би з нього посилання на неіснуючий домен.
    "Ми отримали запит на зміну пароля до вашого акаунта в CRM.",
    `Посилання дійсне ${params.minutes} хвилин і спрацює лише один раз:`,
    "",
    params.url,
    "",
    "Не ви робили цей запит? Просто проігноруйте лист — пароль лишиться попереднім.",
  ].join("\n");

  return { subject: "Відновлення пароля — crm.factory", html, text };
}

export function testEmailHtml(name: string, appUrl: string): string {
  return shell(
    "Пошта працює",
    `<p style="margin:0 0 20px 0;font-size:14.5px;line-height:1.65;color:#475569;">
       Вітаємо, ${escapeHtml(name)}! Це тестовий лист із панелі платформи.
       Якщо ви його бачите — відправка налаштована правильно, і листи про
       відновлення пароля дійдуть до ваших клієнтів.
     </p>
     <p style="margin:0;padding-top:20px;border-top:1px solid #e3e9f2;font-size:12.5px;line-height:1.6;color:#94a3b8;">
       Нічого робити не потрібно — просто перевірка.
     </p>`,
    appUrl,
  );
}

/**
 * Листи про запис — підтвердження і нагадування.
 *
 * Час форматується В UTC — і це навмисно, а не недогляд.
 *
 * У базі час візиту лежить настінним годинником салону: клієнт обрав
 * 09:00, у колонці `2026-08-27T09:00:00.000Z`. Це не дев'ята за Гринвічем,
 * це «дев'ята на годиннику в салоні». Читання в UTC повертає рівно ті
 * цифри, які людина бачила на сторінці запису, — а розбіжність між листом
 * і сторінкою гірша за будь-яку теоретичну правильність.
 *
 * Там, де час іде у ЗОВНІШНЮ систему (файл календаря), наївного читання
 * замало: там викликається `wallClockToUtc`, бо календар клієнта тлумачить
 * позначку буквально.
 */

type AppointmentMail = {
  businessName: string;
  clientName: string;
  service: string;
  employee: string;
  startAt: Date;
  appUrl: string;
  address?: string | null;
  mapsUrl?: string | null;
  phone?: string | null;
  priceLabel?: string | null;
  /** false → салон ще має підтвердити запис вручну. */
  confirmed?: boolean;
};

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Рядок «Послуга — Манікюр» у таблиці листа. */
function row(label: string, value: string): string {
  return `<tr>
  <td style="padding:0 0 6px 0;font-size:13px;color:#64748b;width:96px;vertical-align:top;">${escapeHtml(label)}</td>
  <td style="padding:0 0 6px 0;font-size:14px;color:#0f172a;">${value}</td>
</tr>`;
}

function detailsBlock(params: AppointmentMail): string {
  const rows = [
    row("Послуга", escapeHtml(params.service)),
    row("Майстер", escapeHtml(params.employee)),
  ];

  if (params.priceLabel) rows.push(row("Вартість", escapeHtml(params.priceLabel)));

  if (params.address) {
    const address = escapeHtml(params.address);
    rows.push(
      row(
        "Адреса",
        params.mapsUrl
          ? `<a href="${encodeURI(params.mapsUrl)}" style="color:#2563eb;text-decoration:none;">${address}</a>`
          : address,
      ),
    );
  }

  if (params.phone) {
    const phone = escapeHtml(params.phone);
    rows.push(
      row("Телефон", `<a href="tel:${phone}" style="color:#2563eb;text-decoration:none;">${phone}</a>`),
    );
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0;">
  ${rows.join("\n  ")}
</table>`;
}

function whenBlock(params: AppointmentMail): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0;background:#f6f8fc;border-radius:12px;">
  <tr>
    <td style="padding:16px 18px;">
      <div style="font-size:13px;color:#64748b;margin:0 0 2px 0;">${escapeHtml(formatDay(params.startAt))}</div>
      <div style="font-size:28px;font-weight:600;letter-spacing:-0.02em;color:#0f172a;">${escapeHtml(formatTime(params.startAt))}</div>
    </td>
  </tr>
</table>`;
}

function plainDetails(params: AppointmentMail): string[] {
  const lines = [
    `${formatDay(params.startAt)}, ${formatTime(params.startAt)}`,
    `Послуга: ${params.service}`,
    `Майстер: ${params.employee}`,
  ];
  if (params.priceLabel) lines.push(`Вартість: ${params.priceLabel}`);
  if (params.address) lines.push(`Адреса: ${params.address}`);
  if (params.mapsUrl) lines.push(`На мапі: ${params.mapsUrl}`);
  if (params.phone) lines.push(`Телефон: ${params.phone}`);
  return lines;
}

export function appointmentConfirmationEmail(params: AppointmentMail): {
  subject: string;
  html: string;
  text: string;
} {
  const pending = params.confirmed === false;
  const title = pending ? "Заявку прийнято" : "Ви записані";
  const lead = pending
    ? `${escapeHtml(params.businessName)} отримав вашу заявку. Ми зв'яжемося з вами, щоб підтвердити час.`
    : `Чекаємо на вас у ${escapeHtml(params.businessName)}.`;

  const body = `
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">${lead}</p>
${whenBlock(params)}
${detailsBlock(params)}
<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
  Плани змінилися? Зателефонуйте нам${params.phone ? "" : " — контакти є на сторінці салону"}, і ми перенесемо запис.
</p>`;

  const text = [
    pending
      ? `${params.businessName} отримав вашу заявку. Ми зв'яжемося з вами, щоб підтвердити час.`
      : `Чекаємо на вас у ${params.businessName}.`,
    "",
    ...plainDetails(params),
    "",
    "Плани змінилися? Зателефонуйте нам, і ми перенесемо запис.",
  ].join("\n");

  return {
    subject: pending
      ? `Заявку прийнято — ${params.businessName}`
      : `Ви записані: ${formatDay(params.startAt)}, ${formatTime(params.startAt)}`,
    html: shell(title, body, params.appUrl),
    text,
  };
}

export function appointmentReminderEmail(params: AppointmentMail): {
  subject: string;
  html: string;
  text: string;
} {
  const body = `
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
  ${escapeHtml(params.clientName || "Вітаємо")}, нагадуємо про ваш запис у ${escapeHtml(params.businessName)}.
</p>
${whenBlock(params)}
${detailsBlock(params)}
<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
  Якщо не встигаєте — попередьте нас, будь ласка, заздалегідь. Ми звільнимо час для іншого клієнта.
</p>`;

  const text = [
    `${params.clientName || "Вітаємо"}, нагадуємо про ваш запис у ${params.businessName}.`,
    "",
    ...plainDetails(params),
    "",
    "Якщо не встигаєте — попередьте нас, будь ласка, заздалегідь.",
  ].join("\n");

  return {
    subject: `Нагадування: ${formatDay(params.startAt)}, ${formatTime(params.startAt)}`,
    html: shell("Нагадуємо про запис", body, params.appUrl),
    text,
  };
}

/**
 * Лист із проханням оцінити візит.
 *
 * Зірки — окремі посилання, кожне зі своєю оцінкою в адресі. Це і є вся
 * хитрість: людина ставить оцінку одним дотиком прямо з пошти, а сторінка
 * відкривається вже з обраною зіркою. Форма, яку треба спершу відкрити й
 * лише потім заповнити, втрачає більшість людей на першому ж кроці.
 *
 * Малюємо зірки текстом (★ ☆) у посиланнях, а не картинками: більшість
 * поштових клієнтів блокують зовнішні зображення до дозволу користувача,
 * і замість зірок людина побачила б порожні рамки.
 */
export function reviewRequestEmail(params: {
  businessName: string;
  clientName: string;
  service: string;
  employee: string | null;
  visitedAt: Date;
  /** Базове посилання; до нього додається обрана оцінка. */
  reviewUrl: string;
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const base = encodeURI(params.reviewUrl);
  const home = params.appUrl ?? params.reviewUrl;

  const star = (value: number) => `<a href="${base}?r=${value}"
      style="display:inline-block;padding:4px 6px;font-size:34px;line-height:1;color:#f59e0b;text-decoration:none;"
      title="${value} з 5">★</a>`;

  const body = `
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#334155;">
  ${escapeHtml(params.clientName || "Вітаємо")}, дякуємо, що завітали до
  ${escapeHtml(params.businessName)}.
</p>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
  ${escapeHtml(params.service)}${params.employee ? `, майстер ${escapeHtml(params.employee)}` : ""} —
  ${escapeHtml(formatDay(params.visitedAt))}. Як усе пройшло?
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0;background:#f6f8fc;border-radius:12px;">
  <tr>
    <td align="center" style="padding:18px 12px;">
      <div style="margin:0 0 4px 0;">${[1, 2, 3, 4, 5].map(star).join("")}</div>
      <div style="font-size:12.5px;color:#94a3b8;">Оберіть оцінку — це один дотик</div>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
  Ваша думка допомагає нам стати кращими. Якщо щось було не так — напишіть,
  будь ласка, що саме: ми хочемо про це знати.
</p>`;

  const text = [
    `${params.clientName || "Вітаємо"}, дякуємо, що завітали до ${params.businessName}.`,
    `${params.service}${params.employee ? `, майстер ${params.employee}` : ""} — ${formatDay(params.visitedAt)}.`,
    "",
    "Як усе пройшло? Оцініть візит:",
    ...[1, 2, 3, 4, 5].map((value) => `  ${value} з 5 — ${params.reviewUrl}?r=${value}`),
    "",
    "Якщо щось було не так — напишіть, що саме: ми хочемо про це знати.",
  ].join("\n");

  return {
    subject: `Як пройшов ваш візит у ${params.businessName}?`,
    html: shell("Як усе пройшло?", body, home),
    text,
  };
}

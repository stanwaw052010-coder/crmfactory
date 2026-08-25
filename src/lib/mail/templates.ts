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

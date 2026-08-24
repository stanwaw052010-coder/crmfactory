import "server-only";

/**
 * HTML-листи пишуться таблицями та інлайновими стилями — це не архаїзм,
 * а вимога поштових клієнтів (Outlook не підтримує flex/grid і <style>).
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="uk">
<body style="margin:0;padding:0;background:#f6f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e9f2;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <span style="font-size:17px;font-weight:600;letter-spacing:-0.02em;color:#0f172a;">crm<span style="color:#2563eb;">.</span>factory</span>
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
          Цей лист надіслано автоматично сервісом crm.factory.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetEmail(params: { name: string; url: string; minutes: number }) {
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
  );

  const text = [
    `Вітаємо, ${params.name}!`,
    "",
    "Ми отримали запит на зміну пароля до вашого акаунта crm.factory.",
    `Посилання дійсне ${params.minutes} хвилин і спрацює лише один раз:`,
    "",
    params.url,
    "",
    "Не ви робили цей запит? Просто проігноруйте лист — пароль лишиться попереднім.",
  ].join("\n");

  return { subject: "Відновлення пароля — crm.factory", html, text };
}

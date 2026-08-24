import "server-only";

/**
 * Відправка транзакційних листів.
 *
 * Провайдер — Resend (REST API, без додаткової залежності). Якщо ключ не
 * заданий, лист не зникає безслідно: він друкується в лог сервера, щоб
 * розробник (або власник платформи на етапі первинного налаштування) міг
 * дістати посилання з Vercel → Logs.
 *
 * Fallback у лог — це компроміс для bootstrap-стадії. У проді з реальними
 * клієнтами RESEND_API_KEY має бути заданий: інакше кожен, хто має доступ
 * до логів, зможе перехопити посилання на відновлення пароля.
 */

export type MailChannel = "email" | "log";

export type MailResult = { channel: MailChannel; error?: string };

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function mailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromAddress(): string {
  return process.env.MAIL_FROM?.trim() || "crm.factory <onboarding@resend.dev>";
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      [
        "",
        "──────────────────────────────────────────────────────────────",
        " RESEND_API_KEY не заданий — лист не відправлено, а виведено тут.",
        ` Кому:  ${message.to}`,
        ` Тема:  ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { channel: "log" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[mail] Resend відхилив лист", response.status, detail.slice(0, 500));
      return { channel: "email", error: `resend_${response.status}` };
    }

    return { channel: "email" };
  } catch (error) {
    console.error("[mail] не вдалося звернутися до Resend", error);
    return { channel: "email", error: "network" };
  }
}

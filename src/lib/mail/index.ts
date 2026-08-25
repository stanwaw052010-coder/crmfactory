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

export type MailStatus = {
  configured: boolean;
  from: string;
  /** Пісочниця Resend: листи йдуть ЛИШЕ на адресу власника акаунта. */
  sandboxSender: boolean;
  /** MAIL_FROM розібрано і адреса схожа на справжню. */
  senderValid: boolean;
  /** Домен відправника — його і треба підтвердити в Resend. */
  senderDomain: string | null;
};

const SANDBOX_DOMAIN = "resend.dev";

/**
 * Витягує email із `Назва <email@домен>` або з голої адреси.
 *
 * Перевірка потрібна саме тут, а не лише в Resend: помилка в MAIL_FROM
 * (найчастіше — обрізаний домен, `noreply@business` замість
 * `noreply@mysite.business`) інакше спливе аж у момент, коли клієнт не
 * отримає листа про пароль.
 */
function parseSender(value: string): { email: string | null; domain: string | null } {
  const angled = value.match(/<([^>]+)>/);
  const email = (angled ? angled[1] : value).trim();

  // Локальна частина, @, домен із крапкою та TLD хоча б із двох літер.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return { email: null, domain: null };

  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (!/\.[a-z]{2,}$/.test(domain)) return { email: null, domain: null };

  return { email, domain };
}

export function mailStatus(): MailStatus {
  const from = fromAddress();
  const { email, domain } = parseSender(from);

  return {
    configured: mailEnabled(),
    from,
    sandboxSender: domain === SANDBOX_DOMAIN,
    senderValid: email !== null,
    senderDomain: domain,
  };
}

/**
 * Людське пояснення до відмови Resend.
 *
 * Найчастіша причина — спроба писати на чужу адресу з тестового
 * відправника `onboarding@resend.dev`. Resend віддає на це 403, і без
 * розшифровки повідомлення «щось пішло не так» нічим не допомагає.
 */
function explainResendError(status: number, body: string): string {
  const lowered = body.toLowerCase();

  if (status === 401 || status === 403) {
    if (lowered.includes("own email") || lowered.includes("testing emails")) {
      return (
        "Resend дозволяє тестовому відправнику onboarding@resend.dev писати лише на ваш власний email. " +
        "Щоб писати клієнтам — підтвердіть свій домен у Resend → Domains і вкажіть його в MAIL_FROM."
      );
    }
    if (lowered.includes("domain") && lowered.includes("verif")) {
      return "Домен у MAIL_FROM не підтверджено в Resend. Resend → Domains → Add Domain.";
    }
    return "Resend відхилив ключ. Перевірте RESEND_API_KEY — можливо, скопійовано не повністю.";
  }

  if (status === 422) {
    return "Resend не прийняв адресу відправника. MAIL_FROM має бути у форматі: Назва <email@домен>.";
  }
  if (status === 429) {
    return "Забагато листів за короткий час — Resend тимчасово обмежив відправку.";
  }

  return `Resend повернув помилку ${status}. ${body.slice(0, 200)}`;
}

/**
 * Вкладення листа. `content` — вміст файлу у base64, як того вимагає Resend.
 * Використовується для .ics: лист із записом одразу лягає в календар клієнта.
 */
export type MailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
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
        ...(message.attachments?.length
          ? [` Файли: ${message.attachments.map((f) => f.filename).join(", ")}`]
          : []),
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
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((file) => ({
                filename: file.filename,
                content: file.content,
                ...(file.contentType ? { content_type: file.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[mail] Resend відхилив лист", response.status, detail.slice(0, 500));
      return { channel: "email", error: explainResendError(response.status, detail) };
    }

    return { channel: "email" };
  } catch (error) {
    console.error("[mail] не вдалося звернутися до Resend", error);
    return {
      channel: "email",
      error: "Не вдалося зв'язатися з Resend. Перевірте, чи не блокує вихідні запити ваш хостинг.",
    };
  }
}

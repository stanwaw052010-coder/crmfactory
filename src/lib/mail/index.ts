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
  /** Що не так із самим ключем, якщо це видно ще до звернення до Resend. */
  keyIssue: string | null;
};

const SANDBOX_DOMAIN = "resend.dev";

/** Ключі Resend: `re_`, далі букви, цифри, підкреслення й дефіси. */
const KEY_SHAPE = /^re_[A-Za-z0-9_-]{20,}$/;

/**
 * Що не так із RESEND_API_KEY — наскільки це видно, не питаючи Resend.
 *
 * Сам Resend на будь-яку з цих причин відповідає однаково: 401 «API key is
 * invalid». За цим повідомленням неможливо здогадатися, що ключ узятий у
 * лапки або обрізаний при копіюванні, — а це найчастіші причини. Панель
 * змінних середовища зберігає значення дослівно, разом із лапками.
 *
 * Повертає `null`, якщо ключ не заданий (це окремий випадок) або якщо з
 * вигляду з ним усе гаразд — тоді слово за Resend.
 */
export function apiKeyIssue(): string | null {
  const raw = process.env.RESEND_API_KEY;
  if (!raw || !raw.trim()) return null;

  const key = raw.trim();

  if (/^["'`]|["'`]$/.test(key)) {
    return "ключ узятий у лапки — панель змінних середовища зберігає їх як частину значення. Приберіть лапки на початку й у кінці.";
  }
  if (/\s/.test(key)) {
    return "у ключі є пробіл або перенос рядка — найімовірніше, він скопійований не повністю.";
  }
  if (!key.startsWith("re_")) {
    return "ключі Resend починаються з «re_» — схоже, у змінну потрапило щось інше.";
  }
  if (key.length < 23) {
    return `ключ закороткий (${key.length} символів) — його обрізали при копіюванні. Resend показує ключ лише один раз, тож створіть новий.`;
  }
  if (!KEY_SHAPE.test(key)) {
    return "у ключі є символи, яких у ключах Resend не буває — перевірте, чи скопійовано саме ключ.";
  }

  return null;
}

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
    keyIssue: apiKeyIssue(),
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
    return (
      "Resend не впізнав ключ. Найчастіше це означає, що ключ видалили або перевипустили в Resend → " +
      "API Keys — тоді старе значення перестає діяти назавжди. Створіть новий ключ, скопіюйте його " +
      "цілком (Resend показує ключ лише один раз) і замініть RESEND_API_KEY, після чого потрібен новий деплой."
    );
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

  // Якщо вигляд ключа явно неправильний, звертатися до Resend немає сенсу:
  // він відповість беззмістовним «API key is invalid», а причина відома вже тут.
  const issue = apiKeyIssue();
  if (apiKey && issue) {
    console.error(`[mail] RESEND_API_KEY: ${issue}`);
    return { channel: "email", error: `RESEND_API_KEY: ${issue}` };
  }

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

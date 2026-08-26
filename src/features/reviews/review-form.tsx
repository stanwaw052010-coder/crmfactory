"use client";

import * as React from "react";
import { Check, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitReviewAction } from "@/server/actions/reviews";

/**
 * Форма відгуку, яку бачить клієнт.
 *
 * Ключове рішення — ЩО показувати після оцінки.
 *
 * Спокуслива схема: п'ять зірок ведемо на Google, менше — лишаємо собі.
 * Вона заборонена правилами Google (це review gating), і за неї площадка
 * може зняти бізнесу всі відгуки одразу. Тому посилання на публічну
 * площадку бачать УСІ.
 *
 * Різниця лише в порядку. При низькій оцінці спершу з'являється поле
 * «розкажіть, що сталося» — незадоволеній людині майже завжди треба, щоб
 * її вислухали, і зазвичай на цьому все й закінчується. При високій —
 * подяка й запрошення повторити те саме публічно. Нікого не блокуємо,
 * правил не порушуємо.
 */

const LABELS: Record<number, string> = {
  1: "Дуже погано",
  2: "Погано",
  3: "Нормально",
  4: "Добре",
  5: "Чудово",
};

/** Від чотирьох зірок пропонуємо поділитися публічно. */
const HAPPY_FROM = 4;

export function ReviewForm(props: {
  token: string;
  businessName: string;
  service: string;
  employee: string | null;
  visitedAt: string;
  publicUrl: string | null;
  initialRating: number | null;
  initialComment: string | null;
  alreadySubmitted: boolean;
}) {
  const [rating, setRating] = React.useState<number | null>(props.initialRating);
  const [hover, setHover] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState(props.initialComment ?? "");
  /**
   * Дві різні речі, які легко сплутати.
   *
   * `stored` — оцінка вже долетіла до сервера. Це відбувається мовчки, ще
   * від дотику до зірки: людина сказала головне, і втрачати це через
   * незаповнений коментар не можна.
   *
   * `submitted` — людина СВІДОМО завершила відгук, натиснувши кнопку.
   * Лише тоді доречні подяка й посилання на публічну площадку. Показувати
   * «дякуємо, що сказали нам» одразу після другої зірки — означає
   * попрощатися з людиною раніше, ніж вона встигла написати, що сталося;
   * саме тих слів ми й чекаємо найбільше.
   */
  const [stored, setStored] = React.useState(props.alreadySubmitted);
  const [submitted, setSubmitted] = React.useState(props.alreadySubmitted);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const shown = hover ?? rating;
  const happy = rating !== null && rating >= HAPPY_FROM;

  const visited = React.useMemo(
    () =>
      new Intl.DateTimeFormat("uk-UA", {
        timeZone: "UTC",
        day: "numeric",
        month: "long",
      }).format(new Date(props.visitedAt)),
    [props.visitedAt],
  );

  async function save(value: number, text: string, explicit: boolean) {
    if (explicit) setPending(true);
    setError(null);
    const result = await submitReviewAction({ token: props.token, rating: value, comment: text });
    if (explicit) setPending(false);
    if (result.ok) {
      setStored(true);
      if (explicit) setSubmitted(true);
    } else {
      setError(result.error);
    }
  }

  function pick(value: number) {
    setRating(value);
    setSubmitted(false);
    void save(value, comment, false);
  }

  /**
   * Оцінка, натиснута прямо в листі, зберігається сама — другий дотик
   * на сторінці був би зайвим після того, як людина вже відповіла.
   *
   * Чому це робить БРАУЗЕР, а не сервер при відкритті сторінки, хоча
   * оцінка приходить у самій адресі: посилання в листах масово відкривають
   * машини — корпоративні перевірки безпеки, антивіруси, попередній
   * перегляд поштового клієнта. Збереження на GET означало б потік
   * вигаданих п'ятірок від роботів, а зіпсуту статистику відгуків потім
   * не відчистити. Скрипт вони не виконують, тож тут — саме людина.
   */
  const autoSaved = React.useRef(false);
  React.useEffect(() => {
    if (autoSaved.current) return;
    if (props.initialRating === null || props.alreadySubmitted) return;
    autoSaved.current = true;

    // Стан міняємо вже у відповіді, а не в тілі ефекту: індикатор
    // очікування тут ні до чого — оцінку й так видно на зірках.
    void submitReviewAction({
      token: props.token,
      rating: props.initialRating,
      comment: props.initialComment ?? "",
    }).then((result) => {
      // Саме stored, не submitted: оцінка з листа збережена, але слово
      // клієнту ще не сказане — форма лишається відкритою для коментаря.
      if (result.ok) setStored(true);
      else setError(result.error);
    });
  }, [props.token, props.initialRating, props.initialComment, props.alreadySubmitted]);

  return (
    <div className="w-full max-w-[440px] space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      <header className="space-y-1.5 text-center">
        <p className="text-[13px] text-[var(--fg-subtle)]">{props.businessName}</p>
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-[var(--fg)]">
          Як пройшов ваш візит?
        </h1>
        <p className="text-[13px] text-[var(--fg-muted)]">
          {props.service}
          {props.employee ? `, ${props.employee}` : ""} · {visited}
        </p>
      </header>

      <div
        className="flex items-center justify-center gap-1"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} з 5 — ${LABELS[value]}`}
            aria-pressed={rating === value}
            onMouseEnter={() => setHover(value)}
            onFocus={() => setHover(value)}
            onBlur={() => setHover(null)}
            onClick={() => pick(value)}
            className="rounded-lg p-1.5 transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none active:scale-95"
          >
            <Star
              className={cn(
                "h-9 w-9 transition-colors duration-150",
                shown !== null && value <= shown
                  ? "fill-amber-400 text-amber-400"
                  : "text-[var(--border-strong)]",
              )}
            />
          </button>
        ))}
      </div>

      <p className="min-h-[20px] text-center text-[13px] font-medium text-[var(--fg-muted)]">
        {shown !== null ? LABELS[shown] : "Оберіть оцінку"}
      </p>

      {rating !== null && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="review-comment"
              className="block text-[13px] font-medium text-[var(--fg)]"
            >
              {happy ? "Що сподобалося найбільше?" : "Розкажіть, що сталося"}
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={happy ? 3 : 4}
              maxLength={2000}
              placeholder={
                happy
                  ? "Кілька слів — необов'язково, але майстру буде приємно"
                  : "Ми хочемо знати, щоб виправити. Це побачить лише салон."
              }
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14px] text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)]"
            />
            <p className="text-[12px] leading-relaxed text-[var(--fg-subtle)]">
              {!happy
                ? "Цей відгук іде безпосередньо власнику салону."
                : stored && !submitted
                  ? "Оцінку вже збережено — коментар за бажанням."
                  : ""}
            </p>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => void save(rating, comment, true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : submitted ? (
              <Check className="h-4 w-4" />
            ) : null}
            {submitted ? "Збережено" : "Надіслати відгук"}
          </button>

          {error && (
            <p className="text-center text-[13px] text-[var(--danger)]">{error}</p>
          )}

          {submitted && (
            <div className="space-y-3 border-t border-[var(--border)] pt-4 text-center">
              <p className="text-[14px] font-medium text-[var(--fg)]">
                {happy ? "Дякуємо! 💙" : "Дякуємо, що сказали нам"}
              </p>
              <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
                {happy
                  ? "Якщо маєте хвилину — поділіться враженням там, де вас побачать інші. Для невеликого салону це справді важливо."
                  : "Ми прочитаємо особисто й зробимо висновки. Якщо хочете, можете залишити відгук і публічно."}
              </p>
              {props.publicUrl && (
                <a
                  href={props.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-[14px] font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  Залишити публічний відгук
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

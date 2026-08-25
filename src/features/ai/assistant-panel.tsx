"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { createPortal } from "react-dom";
import { RichText } from "@/features/ai/rich-text";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";
import { askFactoryAiAction } from "@/server/actions/ai";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * Питання, з яких найлегше почати — вони ж пояснюють, що асистент уміє.
 *
 * Кожне навмисно вимагає кількох інструментів і порівняння між ними:
 * на таке питання не відповісти, глянувши на один екран, тож відповідь
 * одразу показує, навіщо тут асистент. Питання на один показник
 * («яка виручка за місяць?») справляють протилежне враження — його
 * видно на дашборді й без AI.
 */
const SUGGESTIONS = [
  "Що приносить найбільше грошей і як це змінилося проти минулого місяця?",
  "Кому з клієнтів пора нагадати про себе і чому саме їм?",
  "Хто з майстрів заробляє найбільше, а хто найзавантаженіший?",
  "Подивись на всі мої цифри за місяць і скажи, що з ними не так",
];

export function AssistantPanel({
  enabled,
  allowed,
  canSeeAnalytics,
}: {
  /** Ключ ANTHROPIC_API_KEY заданий на сервері. */
  enabled: boolean;
  /** Роль і тариф дозволяють користуватися асистентом. */
  allowed: boolean;
  /** Права на зведення по салону — без них кнопки взагалі немає. */
  canSeeAnalytics: boolean;
}) {
  const isClient = useIsClient();
  const [open, setOpen] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("crmf:open-assistant", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("crmf:open-assistant", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Прокрутка донизу після кожної нової репліки.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setError(null);
    setDraft("");
    const history = turns;
    setTurns([...history, { role: "user", content: trimmed }]);
    setPending(true);

    const formData = new FormData();
    formData.append("question", trimmed);
    formData.append("history", JSON.stringify(history));

    const result = await askFactoryAiAction(null, formData);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTurns((current) => [...current, { role: "assistant", content: result.data.text }]);
  }

  // Рядовому майстру асистента не показуємо взагалі: пропонувати
  // апгрейд тарифу тому, хто його не купує, — марно й дратує.
  if (!isClient || !canSeeAnalytics) return null;

  const usable = enabled && allowed;

  return createPortal(
    <>
      {/* Кнопка виклику — праворуч знизу, над мобільною навігацією */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "no-print fixed right-4 bottom-20 z-40 flex h-11 items-center gap-2 rounded-full pr-4 pl-3.5 md:bottom-6",
          "bg-[var(--primary)] text-[13.5px] font-medium text-white shadow-[var(--shadow-brand)]",
          "transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5",
          "hover:shadow-[0_12px_32px_-8px_rgb(37_99_235/0.6)] active:translate-y-0",
          open && "pointer-events-none opacity-0",
        )}
      >
        <Sparkles className="h-4 w-4" />
        factory AI
      </button>

      <AnimatePresence>
        {open && (
          <div className="no-print fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="relative flex h-full w-full max-w-[440px] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-pop)]"
            >
              <header className="flex items-center gap-2.5 border-b border-[var(--border)] px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-[var(--fg)]">factory AI</p>
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    Питання про ваш бізнес — простою мовою
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрити"
                  className="rounded-lg p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {/* Порядок важливий: клієнтці на Starter треба показати
                    тариф, а не пропонувати додати ключ на сервері — це
                    взагалі не її проблема. */}
                {!allowed ? (
                  <NeedsPro />
                ) : !enabled ? (
                  <NotConfigured />
                ) : turns.length === 0 ? (
                  <Suggestions onPick={ask} />
                ) : (
                  turns.map((turn, index) => <Bubble key={index} turn={turn} />)
                )}

                {pending && (
                  <div className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Дивлюся ваші дані…
                  </div>
                )}

                {error && (
                  <p className="animate-fade-up rounded-xl bg-[var(--danger-soft)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--danger)]">
                    {error}
                  </p>
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(draft);
                }}
                className="border-t border-[var(--border)] p-4"
              >
                <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-2 transition-colors focus-within:border-[var(--primary)]">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter надсилає, Shift+Enter — новий рядок: у чаті
                      // очікують саме такої поведінки.
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        ask(draft);
                      }
                    }}
                    rows={1}
                    disabled={!usable || pending}
                    placeholder={
                      usable
                        ? "Запитайте про свій бізнес…"
                        : allowed
                          ? "AI не налаштовано"
                          : "Доступно на тарифі PRO"
                    }
                    className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!usable || pending || draft.trim().length === 0}
                    aria-label="Надіслати"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white transition-all duration-150 hover:brightness-110 disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-[var(--fg-subtle)]">
                  Відповіді будуються з ваших даних. Перевіряйте важливі цифри.
                </p>
              </form>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";

  return (
    <div className={cn("animate-fade-up flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed",
          isUser
            ? "bg-[var(--primary)] whitespace-pre-wrap text-white"
            : "bg-[var(--surface-2)] text-[var(--fg)]",
        )}
      >
        {isUser ? turn.content : <RichText text={turn.content} />}
      </div>
    </div>
  );
}

function Suggestions({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
        Запитайте що завгодно про салон — я подивлюся у ваші записи, оплати та клієнтів
        і відповім числами, а не здогадками.
      </p>
      <div className="stagger space-y-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="w-full rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-left text-[13px] text-[var(--fg)] transition-all duration-150 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-3.5">
      <p className="text-[13px] font-medium text-[var(--warning)]">factory AI вимкнено</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--warning)]">
        Щоб увімкнути, додайте змінну <code className="font-mono">ANTHROPIC_API_KEY</code> у
        налаштуваннях хостингу й перезапустіть деплой. Ключ видається в консолі Anthropic.
      </p>
    </div>
  );
}

function NeedsPro() {
  return (
    <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-soft)] px-4 py-3.5">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        factory AI — на тарифі PRO
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--primary)]">
        Асистент читає ваші записи, оплати й клієнтів і відповідає числами на
        питання простою мовою: що приносить гроші, кому пора нагадати про себе,
        куди зникла виручка.
      </p>
      <a
        href="/settings/billing"
        className="mt-3 inline-flex h-9 items-center rounded-xl bg-[var(--primary)] px-4 text-[13px] font-medium text-white transition-transform duration-150 hover:-translate-y-px"
      >
        Подивитися тарифи
      </a>
    </div>
  );
}

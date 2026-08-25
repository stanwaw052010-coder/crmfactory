"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { SHORTCUTS, SHORTCUT_GROUPS, isTypingTarget, type Shortcut } from "@/lib/shortcuts";

/** Клавіша у вигляді, до якого звикли — сірий кап із рамкою. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 font-sans text-[11.5px] font-medium text-[var(--fg-muted)]">
      {children}
    </kbd>
  );
}

/** Скільки чекати другу клавішу після `g`, перш ніж забути про акорд. */
const CHORD_TIMEOUT_MS = 1500;

export function KeyboardShortcuts({ permissions }: { permissions: string[] }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = React.useState(false);

  const allowed = React.useMemo(
    () =>
      SHORTCUTS.filter(
        (shortcut) => !shortcut.permission || permissions.includes(shortcut.permission),
      ),
    [permissions],
  );

  // Актуальний список у ref: обробник вішається один раз, але має бачити
  // свіжі права, якщо користувач перемкнув workspace без перезавантаження.
  const allowedRef = React.useRef(allowed);
  React.useEffect(() => {
    allowedRef.current = allowed;
  }, [allowed]);

  React.useEffect(() => {
    let pendingPrefix: string | null = null;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    const clearChord = () => {
      pendingPrefix = null;
      if (chordTimer) clearTimeout(chordTimer);
      chordTimer = null;
    };

    const onKey = (event: KeyboardEvent) => {
      // Поле вводу і будь-який модифікатор — не наша справа. ⌘K обробляє
      // командне меню, і перехоплювати його тут не можна.
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key;

      if (key === "?") {
        event.preventDefault();
        setHelpOpen((open) => !open);
        clearChord();
        return;
      }

      if (key === "Escape") {
        clearChord();
        return;
      }

      if (key === "/") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("crmf:open-command-menu"));
        clearChord();
        return;
      }

      const lower = key.toLowerCase();

      // Другий крок акорду
      if (pendingPrefix) {
        const match = allowedRef.current.find(
          (shortcut) =>
            shortcut.keys.length === 2 &&
            shortcut.keys[0] === pendingPrefix &&
            shortcut.keys[1] === lower,
        );
        clearChord();
        if (match?.href) {
          event.preventDefault();
          router.push(match.href);
        }
        return;
      }

      // Початок акорду
      if (allowedRef.current.some((s) => s.keys.length === 2 && s.keys[0] === lower)) {
        event.preventDefault();
        pendingPrefix = lower;
        chordTimer = setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }

      // Одиночна клавіша
      const single = allowedRef.current.find(
        (shortcut) => shortcut.keys.length === 1 && shortcut.keys[0] === lower && shortcut.href,
      );
      if (single?.href) {
        event.preventDefault();
        router.push(single.href);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimer) clearTimeout(chordTimer);
    };
  }, [router]);

  const byGroup = React.useMemo(() => {
    const map = new Map<Shortcut["group"], Shortcut[]>();
    for (const shortcut of allowed) {
      const list = map.get(shortcut.group) ?? [];
      list.push(shortcut);
      map.set(shortcut.group, list);
    }
    return map;
  }, [allowed]);

  return (
    <Modal
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      title="Гарячі клавіші"
      description="Працюють будь-де, окрім полів вводу"
      size="md"
    >
      <div className="space-y-5">
        {SHORTCUT_GROUPS.map((group) => {
          const items = byGroup.get(group);
          if (!items || items.length === 0) return null;

          return (
            <div key={group}>
              <p className="mb-2 text-[11.5px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
                {group}
              </p>
              <ul className="space-y-1">
                {items.map((shortcut) => (
                  <li
                    key={shortcut.keys.join("+")}
                    className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <span className="text-[13.5px] text-[var(--fg)]">{shortcut.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <React.Fragment key={key}>
                          {index > 0 && (
                            <span className="text-[11px] text-[var(--fg-subtle)]">потім</span>
                          )}
                          <Key>{key}</Key>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div>
          <p className="mb-2 text-[11.5px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
            Командне меню
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5">
            <span className="text-[13.5px] text-[var(--fg)]">Пошук по всьому</span>
            <span className="flex shrink-0 items-center gap-1">
              <Key>⌘</Key>
              <Key>K</Key>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

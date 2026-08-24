"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "crmf-theme";

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const THEME_EVENT = "crmf:theme-change";

function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    // Системна тема змінилась — застосовуємо її, лише якщо користувач
    // не обрав конкретну тему вручну.
    if (readTheme() === "system") applyTheme("system");
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onMediaChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onMediaChange);
  };
}

function readTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const theme = React.useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);

  const setTheme = React.useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* приватний режим — тема просто не запам'ятається */
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { theme, setTheme };
}

const OPTIONS: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Світла", icon: Sun },
  { value: "dark", label: "Темна", icon: Moon },
  { value: "system", label: "Системна", icon: Monitor },
];

export function ThemeToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const isDark = theme === "dark";
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Змінити тему"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl text-[var(--fg-muted)]",
          "transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
          className,
        )}
      >
        <Sun className="h-[18px] w-[18px] dark:hidden" />
        <Moon className="hidden h-[18px] w-[18px] dark:block" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
            theme === value
              ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-soft)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Ставить тему до першого рендеру — щоб не було спалаху білим. */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

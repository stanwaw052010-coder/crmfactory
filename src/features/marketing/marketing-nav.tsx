"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#problem", label: "Проблема" },
  { href: "#features", label: "Можливості" },
  { href: "#how", label: "Як це працює" },
  { href: "#pricing", label: "Тарифи" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
        scrolled
          ? "border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3b76f6] to-[#0d47ff]">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
              <path d="M4 19V10l5 3V10l5 3V6l6 4v9z" fill="white" fillOpacity="0.95" />
            </svg>
          </span>
          <span
            className={cn(
              "text-[17px] font-semibold tracking-tight transition-colors",
              scrolled ? "text-[var(--fg)]" : "text-white",
            )}
          >
            crm<span className="text-[#6096fa]">.</span>factory
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                scrolled
                  ? "text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {scrolled && <ThemeToggle compact className="hidden sm:flex" />}
          <Link href="/login" className="hidden sm:block">
            <Button
              variant={scrolled ? "ghost" : "outline"}
              size="sm"
              className={cn(!scrolled && "border-white/20 text-white hover:bg-white/10")}
            >
              Увійти
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Почати безкоштовно</Button>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Меню"
            className={cn(
              "rounded-lg p-2 lg:hidden",
              scrolled ? "text-[var(--fg-muted)]" : "text-white/80",
            )}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 lg:hidden">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-hover)]"
          >
            Увійти
          </Link>
        </div>
      )}
    </header>
  );
}

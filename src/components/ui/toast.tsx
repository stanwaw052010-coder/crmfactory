"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  toast: (input: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast має викликатися всередині <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "text-[var(--success)]",
  error: "text-[var(--danger)]",
  info: "text-[var(--info)]",
  warning: "text-[var(--warning)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (input: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }) => {
      const id = Math.random().toString(36).slice(2);
      const toast: Toast = { id, tone: input.tone ?? "info", ...input };
      setToasts((prev) => [...prev.slice(-3), toast]);
      setTimeout(() => dismiss(id), input.tone === "error" ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, tone: "success" }),
      error: (title, description) => push({ title, description, tone: "error" }),
      info: (title, description) => push({ title, description, tone: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-0 bottom-0 z-[200] flex w-full max-w-sm flex-col gap-2 p-4 sm:bottom-4 sm:right-4 sm:p-0">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto flex items-start gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-pop)]"
              >
                <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", TONE_CLASSES[toast.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--fg)]">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
                      {toast.description}
                    </p>
                  )}
                  {toast.action && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onClick();
                        dismiss(toast.id);
                      }}
                      className="mt-2 text-[12.5px] font-semibold text-[var(--primary)] hover:underline"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Закрити"
                  className="shrink-0 rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

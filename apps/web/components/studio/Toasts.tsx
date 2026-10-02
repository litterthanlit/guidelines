"use client";

import { useStore } from "./store";

export function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-full px-4 py-2 text-[13px] shadow-lift ${
            t.tone === "error" ? "bg-red-600 text-white" : t.tone === "agent" ? "glass border border-line text-ink" : "bg-ink text-white"
          }`}
        >
          {t.tone === "agent" && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-signal">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden />
              Agent
            </span>
          )}
          <span className="truncate">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

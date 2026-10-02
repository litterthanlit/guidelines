"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { StudioMark } from "./Logo";
import { useStore } from "./store";

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function StudioBar() {
  const { brand, status, saving, undo } = useStore();
  const pathname = usePathname();
  const base = `/b/${brand.slug}`;
  const tabs = [
    { href: base, label: "Pages" },
    { href: `${base}/board`, label: "Moodboard" },
    { href: `${base}/tokens`, label: "Tokens" },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !isTyping(e.target)) {
        e.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const statusLabel = status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas/80 px-3 backdrop-blur-md sm:px-4">
        <Link href="/" className="btn btn-ghost -ml-2 px-2!" aria-label="All brands">
          <StudioMark className="size-[18px]" />
        </Link>
        <span className="text-line-strong" aria-hidden>
          /
        </span>
        <h1 className="min-w-0 truncate font-medium tracking-tight">{brand.meta.name}</h1>

        <nav aria-label="Studio sections" className="ml-2 hidden items-center gap-0.5 rounded-full bg-sunken p-0.5 md:flex">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-[13px] transition ${active ? "bg-surface font-medium shadow-float" : "text-ink-2 hover:text-ink"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] sm:inline-flex"
            role="status"
            aria-live="polite"
          >
            <span
              className={`size-1.5 rounded-full ${status === "live" ? "animate-pulse-dot bg-signal" : status === "connecting" ? "bg-warn" : "bg-ink-3"}`}
              aria-hidden
            />
            <span className="font-medium">{saving ? "Saving…" : statusLabel}</span>
            <span className="font-mono text-ink-3">rev {brand.rev}</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => void undo()} title="Undo (⌘Z)">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M5.5 3.5 2.5 6.5l3 3M3 6.5h6.5a4 4 0 0 1 0 8H7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Undo</span>
          </button>
        </div>
      </header>
      {/* Mobile tabs */}
      <nav
        aria-label="Studio sections"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-surface/90 py-2 backdrop-blur-md md:hidden"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={pathname === t.href ? "page" : undefined}
            className={`px-4 py-1 text-[13px] ${pathname === t.href ? "font-medium" : "text-ink-3"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export { isTyping };
